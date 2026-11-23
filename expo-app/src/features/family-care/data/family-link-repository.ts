import { onSnapshot, collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, type Unsubscribe } from 'firebase/firestore';

import { getFirebaseAuth, getFirebaseFirestore } from '@/services/firebase';

export type FamilyLinkRecord = Readonly<{ caregiverUid: string; status: 'active' | 'revoked'; revision: number }>;
export type CaregiverPlan = Readonly<{ time: string; medicationName: string }>;
export type CaregiverScheduleResult = Readonly<{ status: 'loading' | 'ready' | 'revoked' | 'error'; plans: readonly CaregiverPlan[]; message?: string }>;

// Exchanging these UIDs is an MVP pairing procedure, NOT a shareable
// credential. Access is authorized by Firebase Rules on every Firestore read.
export function validateFamilyUid(text: string): string {
  const value = text.trim();
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(value)) {
    throw new Error('Mã tài khoản không hợp lệ. Hãy sao chép đầy đủ mã từ người thân.');
  }
  return value;
}

function checkSession(uid: string): void {
  if (getFirebaseAuth().currentUser?.uid !== uid) {
    throw new Error('Phiên đăng nhập đã thay đổi. Hãy thử đăng nhập lại.');
  }
}

function linkRef(ownerUid: string, caregiverUid: string) {
  return doc(getFirebaseFirestore(), 'elderlyProfiles', ownerUid, 'caregiverLinks', caregiverUid);
}

export async function listOwnCaregiverLinks(ownerUid: string): Promise<FamilyLinkRecord[]> {
  checkSession(ownerUid);
  const docs = await getDocs(collection(getFirebaseFirestore(), 'elderlyProfiles', ownerUid, 'caregiverLinks'));
  checkSession(ownerUid);
  return docs.docs.map((snapshot) => {
    const data = snapshot.data();
    if (data.ownerUid !== ownerUid || data.caregiverUid !== snapshot.id ||
      (data.status !== 'active' && data.status !== 'revoked') ||
      !Number.isSafeInteger(data.revision)) {
      throw new Error('Dữ liệu liên kết không hợp lệ.');
    }
    return { caregiverUid: snapshot.id, status: data.status, revision: data.revision };
  });
}

/** Only the elderly account holder can explicitly create this link. */
export async function approveCaregiverLink(ownerUid: string, rawCaregiverUid: string): Promise<void> {
  checkSession(ownerUid);
  const caregiverUid = validateFamilyUid(rawCaregiverUid);
  if (caregiverUid === ownerUid) throw new Error('Không thể tự liên kết với tài khoản của mình.');
  await setDoc(linkRef(ownerUid, caregiverUid), {
    ownerUid, caregiverUid, status: 'active',
    scopes: { medicationsRead: true, schedulesRead: true },
    revision: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  checkSession(ownerUid);
}

/** Revocation is irreversible for this UID pair in this MVP. */
export async function revokeCaregiverLink(ownerUid: string, rawCaregiverUid: string): Promise<void> {
  checkSession(ownerUid);
  const caregiverUid = validateFamilyUid(rawCaregiverUid);
  const reference = linkRef(ownerUid, caregiverUid);
  const current = await getDoc(reference);
  checkSession(ownerUid);
  if (!current.exists()) throw new Error('Không tìm thấy liên kết để thu hồi.');
  if (current.data().status !== 'active') return;
  const revision = current.data().revision;
  if (!Number.isSafeInteger(revision)) throw new Error('Phiên bản liên kết không hợp lệ.');
  await updateDoc(reference, {
    status: 'revoked',
    revision: revision + 1,
    updatedAt: serverTimestamp(),
  });
  checkSession(ownerUid);
}

type RawMedication = { id: string; name: string; status: string };
type RawSchedule = { medicationId: string; localTime: string; recurrence: string; weekdays: number[]; startDate: string; endDate: string | null; active: boolean };

function currentVietnamDay(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
  const parts = fmt.formatToParts(now);
  const val = (key: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === key)?.value ?? '';
  const today = `${val('year')}-${val('month')}-${val('day')}`;
  const week = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(val('weekday')) + 1;
  return { today, week };
}

/** A pure formatter for a caregiver's read-only, planned medicine times. */
export function deriveCaregiverPlans(medications: readonly RawMedication[], schedules: readonly RawSchedule[], now = new Date()): CaregiverPlan[] {
  const { today, week } = currentVietnamDay(now);
  const names = new Map(medications.filter((med) => med.status === 'active').map((med) => [med.id, med.name]));
  return schedules.flatMap((plan) => {
    const name = names.get(plan.medicationId);
    if (!name || !plan.active || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(plan.localTime)
      || plan.startDate > today || (plan.endDate !== null && plan.endDate < today)
      || !((plan.recurrence === 'daily' && plan.weekdays.length === 7)
        || (plan.recurrence === 'weekly' && plan.weekdays.includes(week)))) return [];
    return [{ time: plan.localTime, medicationName: name }];
  }).sort((a, b) => a.time.localeCompare(b.time) || a.medicationName.localeCompare(b.medicationName));
}

/**
 * Firestore-backed listener for a *known* elderly UID, never an unrestricted
 * collection-group query. The link must exist and remain active. On revocation
 * or permission error, immediately discard the visible data and unsubscribe.
 */
export function watchCaregiverPlans(
  caregiverUid: string,
  rawOwnerUid: string,
  onChange: (result: CaregiverScheduleResult) => void,
): () => void {
  checkSession(caregiverUid);
  const ownerUid = validateFamilyUid(rawOwnerUid);
  if (ownerUid === caregiverUid) throw new Error('Không thể theo dõi chính tài khoản này.');

  let live = true;
  let childSubscriptions: Unsubscribe[] = [];
  let medications: RawMedication[] | null = null;
  let schedules: RawSchedule[] | null = null;

  const clearChildren = () => {
    childSubscriptions.forEach((unsubscribe) => unsubscribe());
    childSubscriptions = [];
    medications = null;
    schedules = null;
  };
  const fail = (message: string) => {
    if (!live) return;
    clearChildren();
    onChange({ status: 'revoked', plans: [], message });
  };
  const emit = () => {
    if (!live) return;
    if (getFirebaseAuth().currentUser?.uid !== caregiverUid) {
      fail('Phiên đăng nhập đã thay đổi.');
      return;
    }
    if (!medications || !schedules) return;
    onChange({ status: 'ready', plans: deriveCaregiverPlans(medications, schedules) });
  };

  onChange({ status: 'loading', plans: [] });
  const unsubscribeLink = onSnapshot(linkRef(ownerUid, caregiverUid), (snapshot) => {
    if (!live) return;
    if (!snapshot.exists() || snapshot.data().status !== 'active'
      || snapshot.data().ownerUid !== ownerUid || snapshot.data().caregiverUid !== caregiverUid) {
      fail('Bạn chưa được cấp quyền hoặc quyền xem đã bị thu hồi.');
      return;
    }
    if (childSubscriptions.length > 0) return; // active listener already running
    const root = getFirebaseFirestore();
    childSubscriptions = [
      onSnapshot(query(collection(root, 'elderlyProfiles', ownerUid, 'medications'), limit(100)), (medDocs) => {
        if (!live) return;
        medications = medDocs.docs.map((d) => ({ id: d.id, name: d.data().name, status: d.data().status }));
        emit();
      }, () => fail('Không thể tiếp tục đọc danh sách thuốc được chia sẻ.')),
      onSnapshot(query(collection(root, 'elderlyProfiles', ownerUid, 'medicationSchedules'), limit(100)), (scheduleDocs) => {
        if (!live) return;
        schedules = scheduleDocs.docs.map((d) => ({
          medicationId: d.data().medicationId, localTime: d.data().localTime,
          recurrence: d.data().recurrence, weekdays: d.data().weekdays,
          startDate: d.data().startDate, endDate: d.data().endDate, active: d.data().active,
        }));
        emit();
      }, () => fail('Không thể tiếp tục đọc lịch thuốc được chia sẻ.')),
    ];
  }, () => fail('Bạn chưa được cấp quyền hoặc quyền xem đã bị thu hồi.'));

  return () => {
    live = false;
    unsubscribeLink();
    clearChildren();
  };
}

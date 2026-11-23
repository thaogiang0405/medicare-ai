import { onSnapshot, collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, updateDoc, type Unsubscribe } from 'firebase/firestore';

import { getFirebaseAuth, getFirebaseFirestore } from '@/services/firebase';
import { isValidMedicationScheduleDate } from '@/features/schedules/domain/medication-schedule-validation';

export type FamilyLinkRecord = Readonly<{ caregiverUid: string; status: 'active' | 'revoked'; revision: number }>;
export type CaregiverPlan = Readonly<{ time: string; medicationName: string }>;
export type CaregiverScheduleResult = Readonly<{
  status: 'loading' | 'ready' | 'revoked' | 'error';
  plans: readonly CaregiverPlan[];
  /** All currently active medicines, including ones without a dose today. */
  medicationNames?: readonly string[];
  /** Vietnam-local calendar date used to compute the displayed plan. */
  scheduleDate?: string;
  message?: string;
}>;

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
      !Number.isSafeInteger(data.revision) || data.revision < 1) {
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
type RawSchedule = { medicationId: string; localTime: string; recurrence: string; weekdays: number[]; startDate: string; endDate: string | null; timeZone: string; active: boolean };

/** Asia/Ho_Chi_Minh has UTC+07 and no DST in this app's date range. */
export function millisecondsUntilNextVietnamDay(now = new Date()): number {
  const dayMs = 24 * 60 * 60 * 1000;
  const offsetMs = 7 * 60 * 60 * 1000;
  const vietNow = now.getTime() + offsetMs;
  const elapsedDay = ((vietNow % dayMs) + dayMs) % dayMs;
  return dayMs - elapsedDay + 100;
}

function currentVietnamDay(now = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
  const parts = fmt.formatToParts(now);
  const val = (key: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === key)?.value ?? '';
  const today = `${val('year')}-${val('month')}-${val('day')}`;
  const week = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(val('weekday')) + 1;
  return { today, week };
}

/** Pure read-only list: do not expose dose strength or instructions. */
export function deriveCaregiverMedicationNames(medications: readonly RawMedication[]): string[] {
  const names = medications
    .filter((medicine) => medicine.status === 'active' && typeof medicine.name === 'string')
    .map((medicine) => medicine.name.trim())
    .filter((name) => name.length > 0);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'vi'));
}

/** A pure formatter for a caregiver's read-only, planned medicine times. */
export function deriveCaregiverPlans(medications: readonly RawMedication[], schedules: readonly RawSchedule[], now = new Date()): CaregiverPlan[] {
  const { today, week } = currentVietnamDay(now);
  const names = new Map(medications.filter((med) => med.status === 'active' && typeof med.name === 'string').map((med) => [med.id, med.name]));
  return schedules.flatMap((plan) => {
    const name = names.get(plan.medicationId);
    const validWeekdays = Array.isArray(plan.weekdays)
      && plan.weekdays.every((day) => Number.isInteger(day) && day >= 1 && day <= 7)
      && new Set(plan.weekdays).size === plan.weekdays.length;
    const repeatsToday = validWeekdays && (
      (plan.recurrence === 'daily'
        && plan.weekdays.length === 7
        && [1, 2, 3, 4, 5, 6, 7].every((day) => plan.weekdays.includes(day)))
      || (plan.recurrence === 'weekly'
        && plan.weekdays.length > 0
        && plan.weekdays.includes(week))
    );
    if (!name || !plan.active || plan.timeZone !== 'Asia/Ho_Chi_Minh'
      || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(plan.localTime)
      || !isValidMedicationScheduleDate(plan.startDate)
      || plan.startDate > today
      || (plan.endDate !== null && (!isValidMedicationScheduleDate(plan.endDate) || plan.endDate < today))
      || !repeatsToday) return [];
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
  let denied = false;
  let childSubscriptions: Unsubscribe[] = [];
  let childGeneration = 0;
  let linkSubscription: Unsubscribe | null = null;
  let midnightTimer: ReturnType<typeof setTimeout> | null = null;
  let medications: RawMedication[] | null = null;
  let schedules: RawSchedule[] | null = null;

  const stopMidnightTimer = () => {
    if (midnightTimer !== null) {
      clearTimeout(midnightTimer);
      midnightTimer = null;
    }
  };
  const stopLink = () => {
    if (linkSubscription) {
      linkSubscription();
      linkSubscription = null;
    }
  };
  const clearChildren = () => {
    // Invalidate callbacks already queued by Firestore before unsubscribing.
    childGeneration += 1;
    childSubscriptions.forEach((unsubscribe) => unsubscribe());
    childSubscriptions = [];
    medications = null;
    schedules = null;
  };
  const fail = (message: string) => {
    if (!live || denied) return;
    denied = true;
    stopMidnightTimer();
    stopLink();
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
    const now = new Date();
    onChange({
      status: 'ready',
      plans: deriveCaregiverPlans(medications, schedules, now),
      medicationNames: deriveCaregiverMedicationNames(medications),
      scheduleDate: currentVietnamDay(now).today,
    });
  };

  // Keep the displayed "today" anchored to the Vietnam-local date even
  // if the caregiver leaves the screen open across midnight.
  const scheduleNextDay = () => {
    if (!live || denied) return;
    midnightTimer = setTimeout(() => {
      midnightTimer = null;
      if (!live || denied) return;
      emit();
      scheduleNextDay();
    }, millisecondsUntilNextVietnamDay());
  };
  onChange({ status: 'loading', plans: [] });
  linkSubscription = onSnapshot(linkRef(ownerUid, caregiverUid), { includeMetadataChanges: true }, (snapshot) => {
    if (!live || denied) return;
    if (snapshot.metadata.fromCache) {
      clearChildren();
      onChange({ status: 'loading', plans: [] });
      return;
    }
    if (!snapshot.exists() || snapshot.data().status !== 'active'
      || snapshot.data().ownerUid !== ownerUid || snapshot.data().caregiverUid !== caregiverUid) {
      fail('Bạn chưa được cấp quyền hoặc quyền xem đã bị thu hồi.');
      return;
    }
    if (childSubscriptions.length > 0) return; // active listener already running
    const root = getFirebaseFirestore();
    const generation = ++childGeneration;
    const subscriptions: Unsubscribe[] = [
      onSnapshot(query(collection(root, 'elderlyProfiles', ownerUid, 'medications'), limit(101)), { includeMetadataChanges: true }, (medDocs) => {
        if (!live || denied || generation !== childGeneration) return;
        if (medDocs.metadata.fromCache) { medications = null; onChange({ status: 'loading', plans: [] }); return; }
        if (medDocs.size > 100) { fail('Danh sách thuốc vượt giới hạn 100 mục của chế độ theo dõi này.'); return; }
        medications = medDocs.docs.flatMap((d) => {
          const data = d.data();
          if (data.ownerUid !== ownerUid || typeof data.name !== 'string'
            || (data.status !== 'active' && data.status !== 'inactive')) return [];
          return [{ id: d.id, name: data.name, status: data.status }];
        });
        emit();
      }, () => {
        if (generation === childGeneration) fail('Không thể tiếp tục đọc danh sách thuốc được chia sẻ.');
      }),
      onSnapshot(query(collection(root, 'elderlyProfiles', ownerUid, 'medicationSchedules'), limit(101)), { includeMetadataChanges: true }, (scheduleDocs) => {
        if (!live || denied || generation !== childGeneration) return;
        if (scheduleDocs.metadata.fromCache) { schedules = null; onChange({ status: 'loading', plans: [] }); return; }
        if (scheduleDocs.size > 100) { fail('Danh sách lịch vượt giới hạn 100 mục của chế độ theo dõi này.'); return; }
        schedules = scheduleDocs.docs.flatMap((d) => {
          const data = d.data();
          if (data.ownerUid !== ownerUid || typeof data.medicationId !== 'string'
            || typeof data.localTime !== 'string' || typeof data.recurrence !== 'string'
            || !Array.isArray(data.weekdays) || typeof data.startDate !== 'string'
            || !(data.endDate === null || typeof data.endDate === 'string')
            || typeof data.timeZone !== 'string' || typeof data.active !== 'boolean') return [];
          return [{
            medicationId: data.medicationId, localTime: data.localTime,
            recurrence: data.recurrence, weekdays: data.weekdays,
            startDate: data.startDate, endDate: data.endDate,
            timeZone: data.timeZone, active: data.active,
          }];
        });
        emit();
      }, () => {
        if (generation === childGeneration) fail('Không thể tiếp tục đọc lịch thuốc được chia sẻ.');
      }),
    ];
    // A synchronous test adapter or already-queued SDK error may revoke the
    // generation before the unsubscribe functions have been assigned.
    if (!live || denied || generation !== childGeneration) {
      subscriptions.forEach((unsubscribe) => unsubscribe());
    } else {
      childSubscriptions = subscriptions;
    }
  }, () => fail('Bạn chưa được cấp quyền hoặc quyền xem đã bị thu hồi.'));
  // If an SDK test adapter calls its snapshot synchronously, fail() may run
  // before the subscription's unsubscribe function is assigned.
  if (denied) stopLink();
  scheduleNextDay();

  return () => {
    live = false;
    stopMidnightTimer();
    stopLink();
    clearChildren();
  };
}

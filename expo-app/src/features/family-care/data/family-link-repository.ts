import { collection, collectionGroup, doc, getDocFromServer, getDocsFromServer, limit, onSnapshot, query, runTransaction, serverTimestamp, setDoc, Timestamp, where, type Unsubscribe } from 'firebase/firestore';

import { getFirebaseAuth, getFirebaseFirestore } from '@/services/firebase';
import { isValidMedicationScheduleDate } from '@/features/schedules/domain/medication-schedule-validation';

export type FamilyLinkStatus = 'pending' | 'active' | 'revoked' | 'rejected';
export type FamilyLinkRecord = Readonly<{ caregiverUid: string; caregiverDisplayName?: string; inviteCode?: string; status: FamilyLinkStatus; revision: number }>;
export type FamilyInvite = Readonly<{ code: string; expiresAt: Date }>;
export type CaregiverConnectionRecord = Readonly<{ ownerUid: string; ownerDisplayName?: string; status: FamilyLinkStatus; revision: number }>;
export type CaregiverConnectionsResult = Readonly<{ status: 'loading' | 'ready' | 'error'; connections: readonly CaregiverConnectionRecord[]; message?: string }>;
export type CaregiverPlan = Readonly<{ time: string; medicationName: string }>;
export type CaregiverScheduleResult = Readonly<{
  status: 'loading' | 'ready' | 'revoked' | 'error';
  plans: readonly CaregiverPlan[];
  medicationNames?: readonly string[];
  scheduleDate?: string;
  message?: string;
}>;

// A Firestore-generated ID is a one-time locator, not an access credential.
export function validateFamilyInviteCode(text: string): string {
  const value = text.trim();
  if (!/^[A-Za-z0-9]{20}$/.test(value)) throw new Error('Mã mời không hợp lệ. Hãy sao chép đầy đủ mã từ người cao tuổi.');
  return value;
}
export function validateFamilyUid(text: string): string {
  const value = text.trim();
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(value)) throw new Error('Mã tài khoản không hợp lệ. Hãy sao chép đầy đủ mã từ người thân.');
  return value;
}
function checkSession(uid: string): void {
  if (getFirebaseAuth().currentUser?.uid !== uid) throw new Error('Phiên đăng nhập đã thay đổi. Hãy thử đăng nhập lại.');
}
function linkRef(ownerUid: string, caregiverUid: string) {
  return doc(getFirebaseFirestore(), 'elderlyProfiles', ownerUid, 'caregiverLinks', caregiverUid);
}
function inviteRef(code: string) { return doc(getFirebaseFirestore(), 'familyInvites', code); }

/** Create a 24-hour invitation. It does not grant health-data access. */
export async function createFamilyInvite(ownerUid: string): Promise<FamilyInvite> {
  checkSession(ownerUid);
  const database = getFirebaseFirestore();
  const profile = await getDocFromServer(doc(database, 'users', ownerUid));
  checkSession(ownerUid);
  if (!profile.exists() || profile.data().uid !== ownerUid || profile.data().primaryRole !== 'elderly'
    || profile.data().roles?.elderly !== true || profile.data().roles?.caregiver !== false
    || typeof profile.data().displayName !== 'string') {
    throw new Error('Chỉ tài khoản người cao tuổi đã hoàn tất hồ sơ mới tạo được mã mời.');
  }
  const reference = doc(collection(database, 'familyInvites'));
  const expiresAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
  await setDoc(reference, {
    ownerUid, ownerDisplayName: profile.data().displayName, inviteCode: reference.id,
    status: 'open', expiresAt, claimedByUid: null, claimedAt: null,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  checkSession(ownerUid);
  return { code: reference.id, expiresAt: expiresAt.toDate() };
}

/** Claim an invite and create a pending link atomically. */
export async function requestCaregiverLink(caregiverUid: string, rawCode: string): Promise<void> {
  checkSession(caregiverUid);
  const code = validateFamilyInviteCode(rawCode);
  const database = getFirebaseFirestore();
  const invitation = inviteRef(code);
  const caregiverProfileRef = doc(database, 'users', caregiverUid);
  await runTransaction(database, async (transaction) => {
    const inviteSnapshot = await transaction.get(invitation);
    const inviteData = inviteSnapshot.exists() ? inviteSnapshot.data() : null;
    const ownerUid = inviteData && typeof inviteData.ownerUid === 'string' ? inviteData.ownerUid : '__missing_owner__';
    const linkReference = linkRef(ownerUid, caregiverUid);
    const [existingLink, caregiverProfile] = await Promise.all([
      transaction.get(linkReference), transaction.get(caregiverProfileRef),
    ]);
    checkSession(caregiverUid);
    if (!inviteData || inviteData.inviteCode !== code || typeof inviteData.ownerDisplayName !== 'string'
      || !(inviteData.expiresAt instanceof Timestamp)) throw new Error('Mã mời không tồn tại hoặc không hợp lệ.');
    if (inviteData.status === 'claimed' && inviteData.claimedByUid === caregiverUid
      && existingLink.exists() && existingLink.data().inviteCode === code && existingLink.data().status === 'pending') return;
    if (inviteData.status !== 'open' || inviteData.expiresAt.toMillis() <= Date.now()) {
      throw new Error('Mã mời đã được sử dụng hoặc hết hạn. Hãy xin mã mới.');
    }
    if (inviteData.ownerUid === caregiverUid) throw new Error('Không thể kết nối tài khoản với chính mình.');
    if (existingLink.exists()) throw new Error('Hai tài khoản đã có yêu cầu hoặc liên kết trước đó.');
    if (!caregiverProfile.exists() || caregiverProfile.data().uid !== caregiverUid
      || caregiverProfile.data().primaryRole !== 'caregiver' || caregiverProfile.data().roles?.caregiver !== true
      || caregiverProfile.data().roles?.elderly !== false || caregiverProfile.data().onboardingCompleted !== true
      || typeof caregiverProfile.data().displayName !== 'string') {
      throw new Error('Chỉ tài khoản người chăm sóc đã hoàn tất hồ sơ mới gửi được yêu cầu.');
    }
    transaction.update(invitation, {
      status: 'claimed', claimedByUid: caregiverUid, claimedAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    transaction.set(linkReference, {
      ownerUid: inviteData.ownerUid, ownerDisplayName: inviteData.ownerDisplayName,
      caregiverUid, caregiverDisplayName: caregiverProfile.data().displayName, inviteCode: code,
      status: 'pending', scopes: { medicationsRead: true, schedulesRead: true },
      revision: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  });
  checkSession(caregiverUid);
}

export async function listOwnCaregiverLinks(ownerUid: string): Promise<FamilyLinkRecord[]> {
  checkSession(ownerUid);
  const docs = await getDocsFromServer(collection(getFirebaseFirestore(), 'elderlyProfiles', ownerUid, 'caregiverLinks'));
  checkSession(ownerUid);
  return docs.docs.map((snapshot) => {
    const data = snapshot.data();
    if (data.ownerUid !== ownerUid || data.caregiverUid !== snapshot.id
      || !['pending', 'active', 'revoked', 'rejected'].includes(data.status)
      || !Number.isSafeInteger(data.revision) || data.revision < 1
      || (data.status === 'pending' && (typeof data.inviteCode !== 'string'
        || typeof data.caregiverDisplayName !== 'string' || typeof data.ownerDisplayName !== 'string'))) {
      throw new Error('Dữ liệu liên kết không hợp lệ.');
    }
    return {
      caregiverUid: snapshot.id,
      caregiverDisplayName: typeof data.caregiverDisplayName === 'string' ? data.caregiverDisplayName : undefined,
      inviteCode: typeof data.inviteCode === 'string' ? data.inviteCode : undefined,
      status: data.status as FamilyLinkStatus, revision: data.revision,
    };
  });
}

async function decidePendingCaregiverLink(ownerUid: string, rawCaregiverUid: string, decision: 'approve' | 'reject'): Promise<void> {
  checkSession(ownerUid);
  const caregiverUid = validateFamilyUid(rawCaregiverUid);
  const database = getFirebaseFirestore();
  const reference = linkRef(ownerUid, caregiverUid);
  await runTransaction(database, async (transaction) => {
    const current = await transaction.get(reference);
    checkSession(ownerUid);
    if (!current.exists()) throw new Error('Không tìm thấy yêu cầu kết nối.');
    const data = current.data();
    if (data.ownerUid !== ownerUid || data.caregiverUid !== caregiverUid || data.status !== 'pending') {
      throw new Error('Yêu cầu không còn ở trạng thái chờ xác nhận.');
    }
    const code = validateFamilyInviteCode(String(data.inviteCode ?? ''));
    const invitation = inviteRef(code);
    const inviteSnapshot = await transaction.get(invitation);
    if (!inviteSnapshot.exists() || inviteSnapshot.data().ownerUid !== ownerUid
      || inviteSnapshot.data().claimedByUid !== caregiverUid || inviteSnapshot.data().status !== 'claimed') {
      throw new Error('Mã mời không còn hợp lệ. Hãy tải lại danh sách yêu cầu.');
    }
    const approved = decision === 'approve';
    transaction.update(reference, { status: approved ? 'active' : 'rejected', revision: data.revision + 1, updatedAt: serverTimestamp() });
    transaction.update(invitation, { status: approved ? 'consumed' : 'rejected', updatedAt: serverTimestamp() });
  });
  checkSession(ownerUid);
}
export async function approvePendingCaregiverLink(ownerUid: string, caregiverUid: string): Promise<void> {
  await verifyOwnerShareableRecords(ownerUid);
  await decidePendingCaregiverLink(ownerUid, caregiverUid, 'approve');
}
export async function rejectPendingCaregiverLink(ownerUid: string, caregiverUid: string): Promise<void> {
  await decidePendingCaregiverLink(ownerUid, caregiverUid, 'reject');
}

/** Revocation is irreversible for this UID pair in this MVP. */
export async function revokeCaregiverLink(ownerUid: string, rawCaregiverUid: string): Promise<void> {
  checkSession(ownerUid);
  const caregiverUid = validateFamilyUid(rawCaregiverUid);
  const reference = linkRef(ownerUid, caregiverUid);
  await runTransaction(getFirebaseFirestore(), async (transaction) => {
    const current = await transaction.get(reference);
    checkSession(ownerUid);
    if (!current.exists()) throw new Error('Không tìm thấy liên kết để thu hồi.');
    const data = current.data();
    if (data.status === 'revoked') return;
    if (data.status !== 'active' || !Number.isSafeInteger(data.revision) || data.revision < 1
      || data.revision >= Number.MAX_SAFE_INTEGER || data.ownerUid !== ownerUid || data.caregiverUid !== caregiverUid) {
      throw new Error('Liên kết cần thu hồi không hợp lệ.');
    }
    transaction.update(reference, { status: 'revoked', revision: data.revision + 1, updatedAt: serverTimestamp() });
  });
  checkSession(ownerUid);
}

/** Caregivers discover only link metadata whose caregiverUid matches their own UID. */
export function watchCaregiverConnections(caregiverUid: string, onChange: (result: CaregiverConnectionsResult) => void): () => void {
  if (getFirebaseAuth().currentUser?.uid !== caregiverUid) {
    onChange({ status: 'error', connections: [], message: 'Phiên đăng nhập đã thay đổi.' });
    return () => undefined;
  }
  let live = true;
  onChange({ status: 'loading', connections: [] });
  const connectionsQuery = query(collectionGroup(getFirebaseFirestore(), 'caregiverLinks'), where('caregiverUid', '==', caregiverUid));
  const unsubscribe = onSnapshot(connectionsQuery, { includeMetadataChanges: true }, (snapshot) => {
    if (!live) return;
    if (getFirebaseAuth().currentUser?.uid !== caregiverUid) {
      onChange({ status: 'error', connections: [], message: 'Phiên đăng nhập đã thay đổi.' });
      return;
    }
    if (snapshot.metadata.fromCache) { onChange({ status: 'loading', connections: [] }); return; }
    try {
      const connections = snapshot.docs.map((document) => {
        const data = document.data();
        const ownerUid = document.ref.parent.parent?.id;
        if (!ownerUid || data.ownerUid !== ownerUid || data.caregiverUid !== caregiverUid
          || !['pending', 'active', 'revoked', 'rejected'].includes(data.status)
          || !Number.isSafeInteger(data.revision) || data.revision < 1
          || (data.ownerDisplayName !== undefined && typeof data.ownerDisplayName !== 'string')) {
          throw new Error('Dữ liệu liên kết không hợp lệ.');
        }
        return {
          ownerUid, ownerDisplayName: typeof data.ownerDisplayName === 'string' ? data.ownerDisplayName : undefined,
          status: data.status as FamilyLinkStatus, revision: data.revision,
        };
      }).sort((a, b) => (a.ownerDisplayName ?? a.ownerUid).localeCompare(b.ownerDisplayName ?? b.ownerUid, 'vi'));
      onChange({ status: 'ready', connections });
    } catch {
      onChange({ status: 'error', connections: [], message: 'Không thể xác thực danh sách hồ sơ đã liên kết.' });
    }
  }, () => {
    if (live) onChange({ status: 'error', connections: [], message: 'Không thể tải danh sách liên kết. Kiểm tra mạng hoặc quyền Firebase.' });
  });
  return () => { live = false; unsubscribe(); };
}

type RawMedication = { id: string; name: string; status: string };
type RawSchedule = { medicationId: string; localTime: string; recurrence: string; weekdays: number[]; startDate: string; endDate: string | null; timeZone: string; active: boolean };

/**
 * Validate the read-only DTO before displaying a caregiver's schedule.
 * A corrupted active row must never be silently omitted: that could make a
 * partially loaded plan look complete to a family member.
 */
const medicationShareFields = [
  'ownerUid', 'name', 'strengthText', 'directionsText', 'status',
  'createdAt', 'updatedAt', 'revision',
] as const;
const scheduleShareFields = [
  'ownerUid', 'medicationId', 'recurrence', 'localTime', 'weekdays',
  'startDate', 'endDate', 'timeZone', 'active', 'revision',
  'createdAt', 'updatedAt',
] as const;

function hasExactFields(data: Record<string, unknown>, fields: readonly string[]): boolean {
  const actual = Object.keys(data);
  return actual.length === fields.length
    && fields.every((field) => Object.prototype.hasOwnProperty.call(data, field));
}

function isFirestoreTimestamp(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const timestamp = value as { seconds?: unknown; nanoseconds?: unknown; toDate?: unknown };
  return Number.isInteger(timestamp.seconds)
    && Number.isInteger(timestamp.nanoseconds)
    && typeof timestamp.toDate === 'function';
}

function isReadableActiveMedication(ownerUid: string, data: Record<string, unknown>): boolean {
  return hasExactFields(data, medicationShareFields)
    && data.ownerUid === ownerUid
    && data.status === 'active'
    && typeof data.name === 'string'
    && data.name.length >= 1 && data.name.length <= 120
    && data.name.trim().length > 0
    && typeof data.strengthText === 'string'
    && data.strengthText.length <= 80
    && typeof data.directionsText === 'string'
    && data.directionsText.length <= 500
    && Number.isSafeInteger(data.revision)
    && Number(data.revision) >= 1
    && isFirestoreTimestamp(data.createdAt)
    && isFirestoreTimestamp(data.updatedAt);
}

function isReadableActiveSchedule(ownerUid: string, data: Record<string, unknown>): boolean {
  const weekdays = data.weekdays;
  if (!hasExactFields(data, scheduleShareFields)
    || data.ownerUid !== ownerUid || data.active !== true
    || typeof data.medicationId !== 'string'
    || data.medicationId.length < 1 || data.medicationId.length > 150
    || data.medicationId.includes('/')
    || typeof data.localTime !== 'string'
    || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(data.localTime)
    || typeof data.startDate !== 'string'
    || !isValidMedicationScheduleDate(data.startDate)
    || !(data.endDate === null || (typeof data.endDate === 'string'
      && isValidMedicationScheduleDate(data.endDate) && data.endDate >= data.startDate))
    || data.timeZone !== 'Asia/Ho_Chi_Minh'
    || !Array.isArray(weekdays)
    || !weekdays.every((day: unknown) => Number.isInteger(day)
      && typeof day === 'number' && day >= 1 && day <= 7)
    || new Set(weekdays).size !== weekdays.length
    || !Number.isSafeInteger(data.revision) || Number(data.revision) < 1
    || !isFirestoreTimestamp(data.createdAt)
    || !isFirestoreTimestamp(data.updatedAt)) return false;
  return (data.recurrence === 'daily' && weekdays.length === 7
    && [1, 2, 3, 4, 5, 6, 7].every((day) => weekdays.includes(day)))
    || (data.recurrence === 'weekly' && weekdays.length > 0);
}

async function verifyOwnerShareableRecords(ownerUid: string): Promise<void> {
  const database = getFirebaseFirestore();
  const [medications, schedules] = await Promise.all([
    getDocsFromServer(query(
      collection(database, 'elderlyProfiles', ownerUid, 'medications'),
      where('status', '==', 'active'),
      limit(101),
    )),
    getDocsFromServer(query(
      collection(database, 'elderlyProfiles', ownerUid, 'medicationSchedules'),
      where('active', '==', true),
      limit(101),
    )),
  ]);
  checkSession(ownerUid);
  if (medications.size > 100 || schedules.size > 100) {
    throw new Error('Dữ liệu đang hoạt động vượt giới hạn chia sẻ 100 mục.');
  }
  if (medications.docs.some((snapshot) => !isReadableActiveMedication(ownerUid, snapshot.data()))) {
    throw new Error('Có bản ghi thuốc đang hoạt động ngoài cấu trúc chia sẻ an toàn. Hãy kiểm tra trước khi cấp quyền.');
  }
  if (schedules.docs.some((snapshot) => !isReadableActiveSchedule(ownerUid, snapshot.data()))) {
    throw new Error('Có lịch thuốc đang hoạt động ngoài cấu trúc chia sẻ an toàn. Hãy kiểm tra trước khi cấp quyền.');
  }
}

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
  const fail = (message: string, status: 'revoked' | 'error' = 'revoked') => {
    if (!live || denied) return;
    denied = true;
    stopMidnightTimer();
    stopLink();
    clearChildren();
    onChange({ status, plans: [], message });
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
      onSnapshot(query(collection(root, 'elderlyProfiles', ownerUid, 'medications'), where('ownerUid', '==', ownerUid), where('status', '==', 'active'), limit(101)), { includeMetadataChanges: true }, (medDocs) => {
        if (!live || denied || generation !== childGeneration) return;
        if (medDocs.metadata.fromCache) { medications = null; onChange({ status: 'loading', plans: [] }); return; }
        if (medDocs.size > 100) {
          fail('Danh sách thuốc vượt giới hạn 100 mục của chế độ theo dõi này.', 'error');
          return;
        }
        const rows = medDocs.docs.map((d) => ({ id: d.id, data: d.data() }));
        if (rows.some(({ data }) => !isReadableActiveMedication(ownerUid, data))) {
          fail('Dữ liệu thuốc được chia sẻ không hợp lệ. Vui lòng nhờ chủ hồ sơ kiểm tra.', 'error');
          return;
        }
        medications = rows.map(({ id, data }) => ({ id, name: data.name, status: 'active' }));
        emit();
      }, () => {
        if (generation === childGeneration) fail('Không thể tiếp tục đọc danh sách thuốc được chia sẻ.', 'error');
      }),
      onSnapshot(query(collection(root, 'elderlyProfiles', ownerUid, 'medicationSchedules'), where('ownerUid', '==', ownerUid), where('active', '==', true), limit(101)), { includeMetadataChanges: true }, (scheduleDocs) => {
        if (!live || denied || generation !== childGeneration) return;
        if (scheduleDocs.metadata.fromCache) { schedules = null; onChange({ status: 'loading', plans: [] }); return; }
        if (scheduleDocs.size > 100) {
          fail('Danh sách lịch vượt giới hạn 100 mục của chế độ theo dõi này.', 'error');
          return;
        }
        const rows = scheduleDocs.docs.map((d) => d.data());
        if (rows.some((data) => !isReadableActiveSchedule(ownerUid, data))) {
          fail('Dữ liệu lịch thuốc được chia sẻ không hợp lệ. Vui lòng nhờ chủ hồ sơ kiểm tra.', 'error');
          return;
        }
        schedules = rows.map((data) => ({
          medicationId: data.medicationId, localTime: data.localTime,
          recurrence: data.recurrence, weekdays: data.weekdays,
          startDate: data.startDate, endDate: data.endDate,
          timeZone: data.timeZone, active: data.active,
        }));
        emit();
      }, () => {
        if (generation === childGeneration) fail('Không thể tiếp tục đọc lịch thuốc được chia sẻ.', 'error');
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

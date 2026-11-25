import type { Auth } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';

import type {
  MedicationSchedule,
  MedicationScheduleRecurrence,
  MedicationScheduleWeekday,
} from '@/types/domain';

import {
  assertValidMedicationScheduleCreateInput,
  assertValidMedicationScheduleUpdateInput,
  MedicationScheduleValidationError,
} from '../domain/medication-schedule-validation';
import type {
  MedicationScheduleCreateInput,
  MedicationScheduleListOptions,
  MedicationScheduleRepository,
  MedicationScheduleUpdateInput,
} from '../domain/medication-schedule-repository';

const medicationScheduleDocumentFields = [
  'ownerUid',
  'medicationId',
  'recurrence',
  'localTime',
  'weekdays',
  'startDate',
  'endDate',
  'timeZone',
  'active',
  'revision',
  'createdAt',
  'updatedAt',
] as const;

type FirebaseScheduleUser = Readonly<{
  uid: string;
}>;

export type FirestoreMedicationScheduleDocument = Readonly<{
  id: string;
  data: unknown;
}>;

/** A narrow, testable port. Auth owns the path identity, not the UI. */
export type FirestoreMedicationSchedulePort = {
  getCurrentAuthUser(): FirebaseScheduleUser | null;
  listMedicationScheduleDocuments(ownerUid: string): Promise<readonly FirestoreMedicationScheduleDocument[]>;
  getMedicationScheduleDocument(
    ownerUid: string,
    scheduleId: string,
  ): Promise<FirestoreMedicationScheduleDocument | null>;
  createMedicationScheduleDocument(
    ownerUid: string,
    input: MedicationScheduleCreateInput,
  ): Promise<FirestoreMedicationScheduleDocument>;
  updateMedicationScheduleDocument(
    ownerUid: string,
    scheduleId: string,
    input: MedicationScheduleUpdateInput,
  ): Promise<FirestoreMedicationScheduleDocument>;
  pauseMedicationScheduleDocument(
    ownerUid: string,
    scheduleId: string,
  ): Promise<FirestoreMedicationScheduleDocument>;
};

export class MedicationScheduleRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MedicationScheduleRepositoryError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactMedicationScheduleFields(data: Record<string, unknown>): boolean {
  const keys = Object.keys(data);
  return keys.length === medicationScheduleDocumentFields.length
    && medicationScheduleDocumentFields.every((field) => Object.prototype.hasOwnProperty.call(data, field));
}

function invalidMedicationScheduleDocument(): MedicationScheduleRepositoryError {
  return new MedicationScheduleRepositoryError(
    'Dữ liệu lịch uống thuốc lưu trữ không hợp lệ. Vui lòng liên hệ chủ dự án.',
  );
}

function normalizeScheduleId(scheduleId: string): string {
  const normalized = scheduleId.trim();

  if (!normalized || normalized.includes('/')) {
    throw new MedicationScheduleRepositoryError('Mã lịch uống thuốc không hợp lệ.');
  }

  return normalized;
}

function readString(value: unknown): string {
  if (typeof value !== 'string') {
    throw invalidMedicationScheduleDocument();
  }

  return value;
}

function readNullableString(value: unknown): string | null {
  return value === null ? null : readString(value);
}

function readTimestamp(value: unknown): string {
  const date = value instanceof Date
    ? value
    : (
      typeof value === 'object'
      && value !== null
      && 'toDate' in value
      && typeof value.toDate === 'function'
        ? value.toDate()
        : null
    );

  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) {
    throw invalidMedicationScheduleDocument();
  }

  return date.toISOString();
}

function readRevision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw invalidMedicationScheduleDocument();
  }

  return value;
}

function readBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') {
    throw invalidMedicationScheduleDocument();
  }

  return value;
}

function readRecurrence(value: unknown): MedicationScheduleRecurrence {
  if (value !== 'daily' && value !== 'weekly') {
    throw invalidMedicationScheduleDocument();
  }

  return value;
}

function readWeekdays(value: unknown): MedicationScheduleWeekday[] {
  if (!Array.isArray(value) || value.some((weekday) => typeof weekday !== 'number')) {
    throw invalidMedicationScheduleDocument();
  }

  return [...value] as MedicationScheduleWeekday[];
}

function requireCurrentAuthOwner(port: FirestoreMedicationSchedulePort, suppliedUserId: string): string {
  const expectedUid = suppliedUserId.trim();
  const currentUser = port.getCurrentAuthUser();

  if (!expectedUid || !currentUser?.uid || currentUser.uid !== expectedUid) {
    throw new MedicationScheduleRepositoryError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  return currentUser.uid;
}

function getFirebaseErrorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code.replace(/^(firestore|auth)\//, '');
  }

  return undefined;
}

/** Converts SDK failures to Vietnamese messages without exposing document data. */
export function mapMedicationScheduleRepositoryError(error: unknown): Error {
  if (error instanceof MedicationScheduleValidationError || error instanceof MedicationScheduleRepositoryError) {
    return error;
  }

  switch (getFirebaseErrorCode(error)) {
    case 'unauthenticated':
      return new MedicationScheduleRepositoryError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    case 'permission-denied':
      return new MedicationScheduleRepositoryError('Bạn không có quyền truy cập lịch uống thuốc của tài khoản này.');
    case 'not-found':
      return new MedicationScheduleRepositoryError('Không tìm thấy lịch uống thuốc của tài khoản hiện tại.');
    case 'aborted':
    case 'failed-precondition':
      return new MedicationScheduleRepositoryError('Lịch uống thuốc vừa thay đổi. Vui lòng tải lại và thử lại.');
    case 'unavailable':
    case 'deadline-exceeded':
    case 'network-request-failed':
      return new MedicationScheduleRepositoryError('Không thể kết nối dữ liệu lịch uống thuốc. Vui lòng kiểm tra mạng và thử lại.');
    default:
      return new MedicationScheduleRepositoryError('Không thể hoàn tất thao tác với lịch uống thuốc. Vui lòng thử lại.');
  }
}

/** Maps an untrusted DTO into a Firebase-independent M3.3 schedule model. */
export function mapFirestoreMedicationScheduleDocument(
  document: FirestoreMedicationScheduleDocument,
  expectedOwnerUid: string,
): MedicationSchedule {
  const id = normalizeScheduleId(document.id);

  if (!isRecord(document.data) || !hasExactMedicationScheduleFields(document.data)) {
    throw invalidMedicationScheduleDocument();
  }

  const ownerUid = readString(document.data.ownerUid);
  if (ownerUid !== expectedOwnerUid) {
    throw new MedicationScheduleRepositoryError('Dữ liệu lịch uống thuốc không khớp với tài khoản hiện tại.');
  }

  let normalized;
  try {
    normalized = assertValidMedicationScheduleCreateInput({
      medicationId: readString(document.data.medicationId),
      recurrence: readRecurrence(document.data.recurrence),
      localTime: readString(document.data.localTime),
      weekdays: readWeekdays(document.data.weekdays),
      startDate: readString(document.data.startDate),
      endDate: readNullableString(document.data.endDate),
    });
  } catch {
    throw invalidMedicationScheduleDocument();
  }

  if (document.data.timeZone !== 'Asia/Ho_Chi_Minh') {
    throw invalidMedicationScheduleDocument();
  }

  readRevision(document.data.revision);

  return {
    id,
    medicationId: normalized.medicationId,
    recurrence: normalized.recurrence,
    localTime: normalized.localTime,
    weekdays: [...normalized.weekdays],
    startDate: normalized.startDate,
    endDate: normalized.endDate,
    timeZone: 'Asia/Ho_Chi_Minh',
    active: readBoolean(document.data.active),
    createdAt: readTimestamp(document.data.createdAt),
    updatedAt: readTimestamp(document.data.updatedAt),
  };
}

function readStoredRevision(data: unknown): number {
  if (!isRecord(data)) {
    throw invalidMedicationScheduleDocument();
  }

  return readRevision(data.revision);
}

function readStoredActive(data: unknown): boolean {
  if (!isRecord(data)) {
    throw invalidMedicationScheduleDocument();
  }

  return readBoolean(data.active);
}

function getFirebaseScheduleComposition(): {
  getFirebaseAuth: () => Auth;
  getFirebaseFirestore: () => Firestore;
} {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/services/firebase');
}

function createFirestoreMedicationSchedulePort(
  auth?: Auth,
  firestore?: Firestore,
): FirestoreMedicationSchedulePort {
  const firebase = (!auth || !firestore) ? getFirebaseScheduleComposition() : null;
  const resolvedAuth = auth ?? firebase!.getFirebaseAuth();
  const resolvedFirestore = firestore ?? firebase!.getFirebaseFirestore();
  const schedulesCollection = (ownerUid: string) =>
    collection(resolvedFirestore, 'elderlyProfiles', ownerUid, 'medicationSchedules');
  const scheduleReference = (ownerUid: string, scheduleId: string) =>
    doc(schedulesCollection(ownerUid), scheduleId);
  const toDocument = (snapshot: { id: string; data(): unknown }): FirestoreMedicationScheduleDocument => ({
    id: snapshot.id,
    data: snapshot.data(),
  });
  const getRequiredDocument = async (
    ownerUid: string,
    scheduleId: string,
    missingMessage: string,
  ): Promise<FirestoreMedicationScheduleDocument> => {
    const snapshot = await getDoc(scheduleReference(ownerUid, scheduleId));

    if (!snapshot.exists()) {
      throw new MedicationScheduleRepositoryError(missingMessage);
    }

    return toDocument(snapshot);
  };

  return {
    getCurrentAuthUser: () => (resolvedAuth.currentUser ? { uid: resolvedAuth.currentUser.uid } : null),
    async listMedicationScheduleDocuments(ownerUid) {
      const snapshot = await getDocs(query(schedulesCollection(ownerUid), orderBy('updatedAt', 'desc')));
      return snapshot.docs.map(toDocument);
    },
    async getMedicationScheduleDocument(ownerUid, scheduleId) {
      const snapshot = await getDoc(scheduleReference(ownerUid, scheduleId));
      return snapshot.exists() ? toDocument(snapshot) : null;
    },
    async createMedicationScheduleDocument(ownerUid, input) {
      const reference = await addDoc(schedulesCollection(ownerUid), {
        ownerUid,
        medicationId: input.medicationId,
        recurrence: input.recurrence,
        localTime: input.localTime,
        weekdays: [...input.weekdays],
        startDate: input.startDate,
        endDate: input.endDate,
        timeZone: 'Asia/Ho_Chi_Minh',
        active: true,
        revision: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return getRequiredDocument(ownerUid, reference.id, 'Không thể xác nhận lịch uống thuốc vừa lưu.');
    },
    async updateMedicationScheduleDocument(ownerUid, scheduleId, input) {
      const reference = scheduleReference(ownerUid, scheduleId);

      await runTransaction(resolvedFirestore, async (transaction) => {
        const current = await transaction.get(reference);

        if (!current.exists()) {
          throw new MedicationScheduleRepositoryError('Không tìm thấy lịch uống thuốc cần chỉnh sửa.');
        }

        transaction.update(reference, {
          recurrence: input.recurrence,
          localTime: input.localTime,
          weekdays: [...input.weekdays],
          startDate: input.startDate,
          endDate: input.endDate,
          revision: readStoredRevision(current.data()) + 1,
          updatedAt: serverTimestamp(),
        });
      });

      return getRequiredDocument(ownerUid, scheduleId, 'Không thể xác nhận lịch uống thuốc vừa cập nhật.');
    },
    async pauseMedicationScheduleDocument(ownerUid, scheduleId) {
      const reference = scheduleReference(ownerUid, scheduleId);

      await runTransaction(resolvedFirestore, async (transaction) => {
        const current = await transaction.get(reference);

        if (!current.exists()) {
          throw new MedicationScheduleRepositoryError('Không tìm thấy lịch uống thuốc cần tạm dừng.');
        }

        if (!readStoredActive(current.data())) {
          return;
        }

        transaction.update(reference, {
          active: false,
          revision: readStoredRevision(current.data()) + 1,
          updatedAt: serverTimestamp(),
        });
      });

      return getRequiredDocument(ownerUid, scheduleId, 'Không thể xác nhận trạng thái lịch uống thuốc.');
    },
  };
}

/**
 * Firestore implementation for M3.3. A legacy session UID can select no
 * path by itself: every request is checked against Firebase Auth before and
 * after the asynchronous SDK operation.
 */
export class FirestoreMedicationScheduleRepository implements MedicationScheduleRepository {
  constructor(
    private readonly schedulePort: FirestoreMedicationSchedulePort = createFirestoreMedicationSchedulePort(),
  ) {}

  async listMedicationSchedules(
    userId: string,
    { medicationId, active }: MedicationScheduleListOptions = {},
  ): Promise<MedicationSchedule[]> {
    try {
      const ownerUid = requireCurrentAuthOwner(this.schedulePort, userId);
      const documents = await this.schedulePort.listMedicationScheduleDocuments(ownerUid);
      requireCurrentAuthOwner(this.schedulePort, ownerUid);

      return documents
        .map((document) => mapFirestoreMedicationScheduleDocument(document, ownerUid))
        .filter((schedule) => medicationId === undefined || schedule.medicationId === medicationId)
        .filter((schedule) => active === undefined || schedule.active === active);
    } catch (error) {
      throw mapMedicationScheduleRepositoryError(error);
    }
  }

  async getMedicationScheduleById(userId: string, scheduleId: string): Promise<MedicationSchedule | null> {
    try {
      const ownerUid = requireCurrentAuthOwner(this.schedulePort, userId);
      const safeScheduleId = normalizeScheduleId(scheduleId);
      const document = await this.schedulePort.getMedicationScheduleDocument(ownerUid, safeScheduleId);
      requireCurrentAuthOwner(this.schedulePort, ownerUid);

      return document ? mapFirestoreMedicationScheduleDocument(document, ownerUid) : null;
    } catch (error) {
      throw mapMedicationScheduleRepositoryError(error);
    }
  }

  async createMedicationSchedule(
    userId: string,
    input: MedicationScheduleCreateInput,
  ): Promise<MedicationSchedule> {
    try {
      const ownerUid = requireCurrentAuthOwner(this.schedulePort, userId);
      const normalizedInput = assertValidMedicationScheduleCreateInput(input);
      const document = await this.schedulePort.createMedicationScheduleDocument(ownerUid, normalizedInput);
      requireCurrentAuthOwner(this.schedulePort, ownerUid);
      return mapFirestoreMedicationScheduleDocument(document, ownerUid);
    } catch (error) {
      throw mapMedicationScheduleRepositoryError(error);
    }
  }

  async updateMedicationSchedule(
    userId: string,
    scheduleId: string,
    input: MedicationScheduleUpdateInput,
  ): Promise<MedicationSchedule> {
    try {
      const ownerUid = requireCurrentAuthOwner(this.schedulePort, userId);
      const safeScheduleId = normalizeScheduleId(scheduleId);
      const normalizedInput = assertValidMedicationScheduleUpdateInput(input);
      const document = await this.schedulePort.updateMedicationScheduleDocument(ownerUid, safeScheduleId, normalizedInput);
      requireCurrentAuthOwner(this.schedulePort, ownerUid);
      return mapFirestoreMedicationScheduleDocument(document, ownerUid);
    } catch (error) {
      throw mapMedicationScheduleRepositoryError(error);
    }
  }

  async pauseMedicationSchedule(userId: string, scheduleId: string): Promise<MedicationSchedule> {
    try {
      const ownerUid = requireCurrentAuthOwner(this.schedulePort, userId);
      const safeScheduleId = normalizeScheduleId(scheduleId);
      const document = await this.schedulePort.pauseMedicationScheduleDocument(ownerUid, safeScheduleId);
      requireCurrentAuthOwner(this.schedulePort, ownerUid);
      return mapFirestoreMedicationScheduleDocument(document, ownerUid);
    } catch (error) {
      throw mapMedicationScheduleRepositoryError(error);
    }
  }
}

let firestoreMedicationScheduleRepository: FirestoreMedicationScheduleRepository | null = null;

export function getFirestoreMedicationScheduleRepository(): FirestoreMedicationScheduleRepository {
  firestoreMedicationScheduleRepository ??= new FirestoreMedicationScheduleRepository();
  return firestoreMedicationScheduleRepository;
}

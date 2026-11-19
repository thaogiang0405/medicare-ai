import type { Auth } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Firestore,
} from 'firebase/firestore';

import type {
  DoseEvent,
  DoseEventMedicationSnapshot,
  DoseEventResponseHistory,
  PersistedDoseResponseStatus,
} from '@/types/domain';

import {
  assertValidDoseEventLocalDate,
  assertValidDoseEventLocalTime,
  doseEventLocalTimeZone,
  getDoseEventId,
  getDoseEventOccurrenceKey,
  getDoseEventScheduledAt,
  type DoseEventResponseInput,
  type DoseTrackingRepository,
} from '../domain/dose-tracking-repository';

const doseEventDocumentFields = [
  'ownerUid',
  'scheduleId',
  'medicationId',
  'occurrenceKey',
  'scheduledAt',
  'scheduledLocalDate',
  'scheduledLocalTime',
  'timeZone',
  'medicationSnapshot',
  'status',
  'responseSource',
  'respondedAt',
  'respondedBy',
  'responseHistory',
  'revision',
  'createdAt',
  'updatedAt',
] as const;

type FirebaseDoseEventUser = Readonly<{ uid: string }>;

export type FirestoreDoseEventDocument = Readonly<{
  id: string;
  data: unknown;
}>;

/** A narrow Auth/Firestore port keeps the repository testable without native modules. */
export type FirestoreDoseEventPort = {
  getCurrentAuthUser(): FirebaseDoseEventUser | null;
  listDoseEventDocuments(
    ownerUid: string,
    scheduledLocalDate: string,
  ): Promise<readonly FirestoreDoseEventDocument[]>;
  recordDoseEventDocument(
    ownerUid: string,
    eventId: string,
    input: DoseEventResponseInput,
  ): Promise<FirestoreDoseEventDocument>;
};

export class DoseEventRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DoseEventRepositoryError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactFields(data: Record<string, unknown>, fields: readonly string[]): boolean {
  const keys = Object.keys(data);
  return keys.length === fields.length
    && fields.every((field) => Object.prototype.hasOwnProperty.call(data, field));
}

function invalidDoseEventDocument(): DoseEventRepositoryError {
  return new DoseEventRepositoryError(
    'Dữ liệu phản hồi uống thuốc không hợp lệ. Vui lòng liên hệ chủ dự án.',
  );
}

function readString(value: unknown): string {
  if (typeof value !== 'string') {
    throw invalidDoseEventDocument();
  }

  return value;
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
    throw invalidDoseEventDocument();
  }

  return date.toISOString();
}

function readPersistedStatus(value: unknown): PersistedDoseResponseStatus {
  if (value !== 'reportedTaken' && value !== 'reportedSkipped') {
    throw invalidDoseEventDocument();
  }

  return value;
}

function readRevision(value: unknown): number {
  if (value !== 1) {
    throw invalidDoseEventDocument();
  }

  return value;
}

function readMedicationSnapshot(value: unknown): DoseEventMedicationSnapshot {
  if (!isRecord(value) || !hasExactFields(value, ['name', 'strengthText', 'directionsText'])) {
    throw invalidDoseEventDocument();
  }

  return {
    name: readString(value.name),
    strengthText: readString(value.strengthText),
    directionsText: readString(value.directionsText),
  };
}

function readResponseHistory(value: unknown): DoseEventResponseHistory {
  if (!isRecord(value) || !hasExactFields(value, ['initial']) || !isRecord(value.initial)) {
    throw invalidDoseEventDocument();
  }

  const initial = value.initial;

  if (!hasExactFields(initial, ['status', 'responseSource', 'respondedAt', 'respondedBy'])) {
    throw invalidDoseEventDocument();
  }

  const status = readPersistedStatus(initial.status);
  const responseSource = readString(initial.responseSource);

  if (responseSource !== 'selfReported') {
    throw invalidDoseEventDocument();
  }

  return {
    initial: {
      status,
      responseSource,
      respondedAt: readTimestamp(initial.respondedAt),
      respondedBy: readString(initial.respondedBy),
    },
  };
}

function normalizeDocumentId(value: string, message: string): string {
  const normalized = value.trim();

  if (!normalized || normalized.length > 150 || normalized.includes('/')) {
    throw new DoseEventRepositoryError(message);
  }

  return normalized;
}

function normalizeResponseInput(input: DoseEventResponseInput): DoseEventResponseInput {
  const scheduleId = normalizeDocumentId(input.scheduleId, 'Mã lịch thuốc không hợp lệ.');
  const medicationId = normalizeDocumentId(input.medicationId, 'Mã thuốc không hợp lệ.');
  const scheduledLocalDate = assertValidDoseEventLocalDate(input.scheduledLocalDate);
  const scheduledLocalTime = assertValidDoseEventLocalTime(input.scheduledLocalTime);

  if (input.status !== 'reportedTaken' && input.status !== 'reportedSkipped') {
    throw new DoseEventRepositoryError('Trạng thái phản hồi thuốc không hợp lệ.');
  }

  if (input.occurrenceKey !== getDoseEventOccurrenceKey(scheduledLocalDate, scheduledLocalTime)) {
    throw new DoseEventRepositoryError('Mã lần uống thuốc không khớp với lịch dự kiến.');
  }

  if (input.scheduledAt !== getDoseEventScheduledAt(scheduledLocalDate, scheduledLocalTime)) {
    throw new DoseEventRepositoryError('Thời điểm dự kiến không khớp với múi giờ Việt Nam.');
  }

  const snapshot = input.medicationSnapshot;

  if (
    !snapshot
    || typeof snapshot.name !== 'string'
    || !snapshot.name.trim()
    || snapshot.name.length > 120
    || typeof snapshot.strengthText !== 'string'
    || snapshot.strengthText.length > 80
    || typeof snapshot.directionsText !== 'string'
    || snapshot.directionsText.length > 500
  ) {
    throw new DoseEventRepositoryError('Thông tin thuốc tại thời điểm phản hồi không hợp lệ.');
  }

  return {
    ...input,
    scheduleId,
    medicationId,
    scheduledLocalDate,
    scheduledLocalTime,
    medicationSnapshot: {
      name: snapshot.name,
      strengthText: snapshot.strengthText,
      directionsText: snapshot.directionsText,
    },
  };
}

function requireCurrentAuthOwner(port: FirestoreDoseEventPort, suppliedUserId: string): string {
  const expectedUid = suppliedUserId.trim();
  const currentUser = port.getCurrentAuthUser();

  if (!expectedUid || !currentUser?.uid || currentUser.uid !== expectedUid) {
    throw new DoseEventRepositoryError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  return currentUser.uid;
}

function getFirebaseErrorCode(error: unknown): string | undefined {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && typeof error.code === 'string'
    ? error.code
    : undefined;
}

function mapDoseEventRepositoryError(error: unknown): Error {
  if (error instanceof DoseEventRepositoryError) {
    return error;
  }

  if (getFirebaseErrorCode(error) === 'permission-denied') {
    return new DoseEventRepositoryError('Bạn không có quyền ghi nhận phản hồi cho lịch thuốc này.');
  }

  if (getFirebaseErrorCode(error) === 'unavailable') {
    return new DoseEventRepositoryError('Không thể kết nối Firebase. Vui lòng kiểm tra mạng rồi thử lại.');
  }

  return new DoseEventRepositoryError('Không thể lưu phản hồi uống thuốc. Vui lòng thử lại.');
}

export function mapFirestoreDoseEventDocument(
  document: FirestoreDoseEventDocument,
  expectedOwnerUid: string,
): DoseEvent {
  const id = normalizeDocumentId(document.id, 'Mã phản hồi uống thuốc không hợp lệ.');

  if (!isRecord(document.data) || !hasExactFields(document.data, doseEventDocumentFields)) {
    throw invalidDoseEventDocument();
  }

  const ownerUid = readString(document.data.ownerUid);
  const scheduleId = normalizeDocumentId(readString(document.data.scheduleId), 'Mã lịch thuốc không hợp lệ.');
  const medicationId = normalizeDocumentId(readString(document.data.medicationId), 'Mã thuốc không hợp lệ.');
  const scheduledLocalDate = assertValidDoseEventLocalDate(readString(document.data.scheduledLocalDate));
  const scheduledLocalTime = assertValidDoseEventLocalTime(readString(document.data.scheduledLocalTime));
  const occurrenceKey = readString(document.data.occurrenceKey);
  const scheduledAt = readTimestamp(document.data.scheduledAt);
  const status = readPersistedStatus(document.data.status);
  const responseSource = readString(document.data.responseSource);
  const respondedAt = readTimestamp(document.data.respondedAt);
  const respondedBy = readString(document.data.respondedBy);
  const medicationSnapshot = readMedicationSnapshot(document.data.medicationSnapshot);
  const responseHistory = readResponseHistory(document.data.responseHistory);

  if (
    ownerUid !== expectedOwnerUid
    || responseSource !== 'selfReported'
    || document.data.timeZone !== doseEventLocalTimeZone
    || id !== getDoseEventId(scheduleId, scheduledLocalDate, scheduledLocalTime)
    || occurrenceKey !== getDoseEventOccurrenceKey(scheduledLocalDate, scheduledLocalTime)
    || scheduledAt !== getDoseEventScheduledAt(scheduledLocalDate, scheduledLocalTime)
    || respondedBy !== ownerUid
    || responseHistory.initial.status !== status
    || responseHistory.initial.responseSource !== responseSource
    || responseHistory.initial.respondedBy !== respondedBy
    || responseHistory.initial.respondedAt !== respondedAt
  ) {
    throw invalidDoseEventDocument();
  }

  readRevision(document.data.revision);
  readTimestamp(document.data.createdAt);
  readTimestamp(document.data.updatedAt);

  return {
    id,
    ownerUid,
    scheduleId,
    medicationId,
    occurrenceKey,
    scheduledAt,
    scheduledLocalDate,
    scheduledLocalTime,
    timeZone: doseEventLocalTimeZone,
    medicationSnapshot,
    status,
    responseSource,
    respondedAt,
    respondedBy,
    responseHistory,
    revision: 1,
  };
}

function getFirebaseDoseEventComposition(): {
  getFirebaseAuth: () => Auth;
  getFirebaseFirestore: () => Firestore;
} {
  // Load the native Auth boundary only if this explicitly enabled repository is used.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/services/firebase');
}

function createFirestoreDoseEventPort(auth?: Auth, firestore?: Firestore): FirestoreDoseEventPort {
  const firebase = (!auth || !firestore) ? getFirebaseDoseEventComposition() : null;
  const resolvedAuth = auth ?? firebase!.getFirebaseAuth();
  const resolvedFirestore = firestore ?? firebase!.getFirebaseFirestore();
  const doseEventsCollection = (ownerUid: string) =>
    collection(resolvedFirestore, 'elderlyProfiles', ownerUid, 'doseEvents');
  const doseEventReference = (ownerUid: string, eventId: string) =>
    doc(doseEventsCollection(ownerUid), eventId);
  const toDocument = (snapshot: { id: string; data(): unknown }): FirestoreDoseEventDocument => ({
    id: snapshot.id,
    data: snapshot.data(),
  });
  const getRequiredDocument = async (ownerUid: string, eventId: string): Promise<FirestoreDoseEventDocument> => {
    const snapshot = await getDoc(doseEventReference(ownerUid, eventId));

    if (!snapshot.exists()) {
      throw new DoseEventRepositoryError('Không thể xác nhận phản hồi vừa lưu.');
    }

    return toDocument(snapshot);
  };

  return {
    getCurrentAuthUser: () => (resolvedAuth.currentUser ? { uid: resolvedAuth.currentUser.uid } : null),
    async listDoseEventDocuments(ownerUid, scheduledLocalDate) {
      const snapshot = await getDocs(query(
        doseEventsCollection(ownerUid),
        where('scheduledLocalDate', '==', scheduledLocalDate),
      ));
      return snapshot.docs.map(toDocument);
    },
    async recordDoseEventDocument(ownerUid, eventId, input) {
      const reference = doseEventReference(ownerUid, eventId);
      const existingDocument = await runTransaction(resolvedFirestore, async (transaction) => {
        const existing = await transaction.get(reference);

        if (existing.exists()) {
          const existingDocument = toDocument(existing);
          const mapped = mapFirestoreDoseEventDocument(existingDocument, ownerUid);

          if (mapped.status !== input.status) {
            throw new DoseEventRepositoryError(
              'Phản hồi cho lần uống này đã được xác nhận và không thể thay đổi.',
            );
          }

          return existingDocument;
        }

        // The prior transaction read makes this a deterministic create-only
        // write: a concurrent writer retries and then reads the immutable event.
        transaction.set(reference, {
          ownerUid,
          scheduleId: input.scheduleId,
          medicationId: input.medicationId,
          occurrenceKey: input.occurrenceKey,
          scheduledAt: new Date(input.scheduledAt),
          scheduledLocalDate: input.scheduledLocalDate,
          scheduledLocalTime: input.scheduledLocalTime,
          timeZone: doseEventLocalTimeZone,
          medicationSnapshot: input.medicationSnapshot,
          status: input.status,
          responseSource: 'selfReported',
          respondedAt: serverTimestamp(),
          respondedBy: ownerUid,
          responseHistory: {
            initial: {
              status: input.status,
              responseSource: 'selfReported',
              respondedAt: serverTimestamp(),
              respondedBy: ownerUid,
            },
          },
          revision: 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return null;
      });

      return existingDocument ?? getRequiredDocument(ownerUid, eventId);
    },
  };
}

/**
 * M3.4 Firestore repository: it derives the document path from Firebase Auth,
 * creates one immutable self-report per deterministic occurrence, and never
 * updates a confirmed response.
 */
export class FirestoreDoseEventRepository implements DoseTrackingRepository {
  constructor(private readonly doseEventPort: FirestoreDoseEventPort = createFirestoreDoseEventPort()) {}

  async listDoseEventsForLocalDate(userId: string, scheduledLocalDate: string): Promise<DoseEvent[]> {
    try {
      const ownerUid = requireCurrentAuthOwner(this.doseEventPort, userId);
      const safeDate = assertValidDoseEventLocalDate(scheduledLocalDate);
      const documents = await this.doseEventPort.listDoseEventDocuments(ownerUid, safeDate);
      requireCurrentAuthOwner(this.doseEventPort, ownerUid);

      return documents
        .map((document) => mapFirestoreDoseEventDocument(document, ownerUid))
        .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt) || left.id.localeCompare(right.id));
    } catch (error) {
      throw mapDoseEventRepositoryError(error);
    }
  }

  async recordDoseResponse(userId: string, input: DoseEventResponseInput): Promise<DoseEvent> {
    try {
      const ownerUid = requireCurrentAuthOwner(this.doseEventPort, userId);
      const normalizedInput = normalizeResponseInput(input);
      const scheduledAt = new Date(normalizedInput.scheduledAt);

      if (scheduledAt.valueOf() > Date.now()) {
        throw new DoseEventRepositoryError('Chỉ có thể tự báo sau giờ uống thuốc dự kiến.');
      }

      const eventId = getDoseEventId(
        normalizedInput.scheduleId,
        normalizedInput.scheduledLocalDate,
        normalizedInput.scheduledLocalTime,
      );
      const document = await this.doseEventPort.recordDoseEventDocument(ownerUid, eventId, normalizedInput);
      requireCurrentAuthOwner(this.doseEventPort, ownerUid);
      const event = mapFirestoreDoseEventDocument(document, ownerUid);

      if (event.status !== normalizedInput.status) {
        throw new DoseEventRepositoryError(
          'Phản hồi cho lần uống này đã được xác nhận và không thể thay đổi.',
        );
      }

      return event;
    } catch (error) {
      throw mapDoseEventRepositoryError(error);
    }
  }
}

let firestoreDoseEventRepository: FirestoreDoseEventRepository | null = null;

export function getFirestoreDoseEventRepository(): FirestoreDoseEventRepository {
  firestoreDoseEventRepository ??= new FirestoreDoseEventRepository();
  return firestoreDoseEventRepository;
}

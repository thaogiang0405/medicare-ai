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

import type { Medication, MedicationStatus } from '@/types/domain';

import { assertValidMedicationInput, MedicationValidationError } from '../domain/medication-validation';
import type {
  MedicationInput,
  MedicationListOptions,
  MedicationRepository,
} from '../domain/medication-repository';

const medicationDocumentFields = [
  'ownerUid',
  'name',
  'strengthText',
  'directionsText',
  'status',
  'createdAt',
  'updatedAt',
  'revision',
] as const;

type FirebaseMedicationUser = Readonly<{
  uid: string;
}>;

export type FirestoreMedicationDocument = Readonly<{
  id: string;
  data: unknown;
}>;

/** A narrow, testable port. Its UID is supplied only after Auth verification. */
export type FirestoreMedicationPort = {
  getCurrentAuthUser(): FirebaseMedicationUser | null;
  listMedicationDocuments(ownerUid: string): Promise<readonly FirestoreMedicationDocument[]>;
  getMedicationDocument(ownerUid: string, medicationId: string): Promise<FirestoreMedicationDocument | null>;
  createMedicationDocument(ownerUid: string, input: MedicationInput): Promise<FirestoreMedicationDocument>;
  updateMedicationDocument(
    ownerUid: string,
    medicationId: string,
    input: MedicationInput,
  ): Promise<FirestoreMedicationDocument>;
  markMedicationInactiveDocument(ownerUid: string, medicationId: string): Promise<FirestoreMedicationDocument>;
};

export class MedicationRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MedicationRepositoryError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactMedicationFields(data: Record<string, unknown>): boolean {
  const keys = Object.keys(data);

  return keys.length === medicationDocumentFields.length
    && medicationDocumentFields.every((field) => Object.prototype.hasOwnProperty.call(data, field));
}

function invalidMedicationDocument(): MedicationRepositoryError {
  return new MedicationRepositoryError('Dữ liệu thuốc lưu trữ không hợp lệ. Vui lòng liên hệ chủ dự án.');
}

function normalizeMedicationId(medicationId: string): string {
  const normalized = medicationId.trim();

  if (!normalized || normalized.includes('/')) {
    throw new MedicationRepositoryError('Mã thuốc không hợp lệ.');
  }

  return normalized;
}

function readString(value: unknown): string {
  if (typeof value !== 'string') {
    throw invalidMedicationDocument();
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
    throw invalidMedicationDocument();
  }

  return date.toISOString();
}

function readRevision(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw invalidMedicationDocument();
  }

  return value;
}

function readMedicationStatus(value: unknown): MedicationStatus {
  if (value !== 'active' && value !== 'inactive') {
    throw invalidMedicationDocument();
  }

  return value;
}

function requireCurrentAuthOwner(port: FirestoreMedicationPort, suppliedUserId: string): string {
  const expectedUid = suppliedUserId.trim();
  const currentUser = port.getCurrentAuthUser();

  if (!expectedUid || !currentUser?.uid || currentUser.uid !== expectedUid) {
    throw new MedicationRepositoryError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  return currentUser.uid;
}

function getFirebaseErrorCode(error: unknown): string | undefined {
  if (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && typeof error.code === 'string'
  ) {
    return error.code.replace(/^(firestore|auth)\//, '');
  }

  return undefined;
}

/** Converts SDK failures to messages safe to render without leaking document data. */
export function mapMedicationRepositoryError(error: unknown): Error {
  if (error instanceof MedicationValidationError || error instanceof MedicationRepositoryError) {
    return error;
  }

  switch (getFirebaseErrorCode(error)) {
    case 'unauthenticated':
      return new MedicationRepositoryError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    case 'permission-denied':
      return new MedicationRepositoryError('Bạn không có quyền truy cập dữ liệu thuốc của tài khoản này.');
    case 'not-found':
      return new MedicationRepositoryError('Không tìm thấy thuốc của tài khoản hiện tại.');
    case 'aborted':
    case 'failed-precondition':
      return new MedicationRepositoryError('Dữ liệu thuốc vừa thay đổi. Vui lòng tải lại và thử lại.');
    case 'unavailable':
    case 'deadline-exceeded':
    case 'network-request-failed':
      return new MedicationRepositoryError('Không thể kết nối dữ liệu thuốc. Vui lòng kiểm tra mạng và thử lại.');
    default:
      return new MedicationRepositoryError('Không thể hoàn tất thao tác với dữ liệu thuốc. Vui lòng thử lại.');
  }
}

/** Maps an untrusted Firestore DTO to the Firebase-independent medication model. */
export function mapFirestoreMedicationDocument(
  document: FirestoreMedicationDocument,
  expectedOwnerUid: string,
): Medication {
  const id = normalizeMedicationId(document.id);

  if (!isRecord(document.data) || !hasExactMedicationFields(document.data)) {
    throw invalidMedicationDocument();
  }

  const ownerUid = readString(document.data.ownerUid);

  if (ownerUid !== expectedOwnerUid) {
    throw new MedicationRepositoryError('Dữ liệu thuốc không khớp với tài khoản hiện tại.');
  }

  let input: MedicationInput;

  try {
    input = assertValidMedicationInput({
      name: readString(document.data.name),
      strengthText: readString(document.data.strengthText),
      directionsText: readString(document.data.directionsText),
    });
  } catch {
    throw invalidMedicationDocument();
  }

  // Validate persisted optimistic-concurrency metadata even though it remains
  // intentionally outside the portable domain model.
  readRevision(document.data.revision);

  return {
    id,
    ...input,
    status: readMedicationStatus(document.data.status),
    createdAt: readTimestamp(document.data.createdAt),
    updatedAt: readTimestamp(document.data.updatedAt),
  };
}

function readStoredRevision(data: unknown): number {
  if (!isRecord(data)) {
    throw invalidMedicationDocument();
  }

  return readRevision(data.revision);
}

function readStoredStatus(data: unknown): MedicationStatus {
  if (!isRecord(data)) {
    throw invalidMedicationDocument();
  }

  return readMedicationStatus(data.status);
}

function getFirebaseMedicationComposition(): {
  getFirebaseAuth: () => Auth;
  getFirebaseFirestore: () => Firestore;
} {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/services/firebase');
}

function createFirestoreMedicationPort(
  auth?: Auth,
  firestore?: Firestore,
): FirestoreMedicationPort {
  // Firebase Auth imports React Native AsyncStorage. Load that composition
  // boundary only when the Firestore repository is actually selected, so the
  // default M3.1 mock path remains independent of native Firebase modules.
  const firebase = (!auth || !firestore)
    ? getFirebaseMedicationComposition()
    : null;
  const resolvedAuth = auth ?? firebase!.getFirebaseAuth();
  const resolvedFirestore = firestore ?? firebase!.getFirebaseFirestore();
  const medicationCollection = (ownerUid: string) =>
    collection(resolvedFirestore, 'elderlyProfiles', ownerUid, 'medications');
  const medicationReference = (ownerUid: string, medicationId: string) =>
    doc(medicationCollection(ownerUid), medicationId);
  const toDocument = (snapshot: { id: string; data(): unknown }): FirestoreMedicationDocument => ({
    id: snapshot.id,
    data: snapshot.data(),
  });
  const getRequiredDocument = async (
    ownerUid: string,
    medicationId: string,
    missingMessage: string,
  ): Promise<FirestoreMedicationDocument> => {
    const snapshot = await getDoc(medicationReference(ownerUid, medicationId));

    if (!snapshot.exists()) {
      throw new MedicationRepositoryError(missingMessage);
    }

    return toDocument(snapshot);
  };

  return {
    getCurrentAuthUser: () => (resolvedAuth.currentUser ? { uid: resolvedAuth.currentUser.uid } : null),
    async listMedicationDocuments(ownerUid) {
      const snapshot = await getDocs(query(medicationCollection(ownerUid), orderBy('updatedAt', 'desc')));
      return snapshot.docs.map(toDocument);
    },
    async getMedicationDocument(ownerUid, medicationId) {
      const snapshot = await getDoc(medicationReference(ownerUid, medicationId));
      return snapshot.exists() ? toDocument(snapshot) : null;
    },
    async createMedicationDocument(ownerUid, input) {
      const reference = await addDoc(medicationCollection(ownerUid), {
        ownerUid,
        ...input,
        status: 'active',
        revision: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return getRequiredDocument(ownerUid, reference.id, 'Không thể xác nhận thuốc vừa lưu.');
    },
    async updateMedicationDocument(ownerUid, medicationId, input) {
      const reference = medicationReference(ownerUid, medicationId);

      await runTransaction(resolvedFirestore, async (transaction) => {
        const current = await transaction.get(reference);

        if (!current.exists()) {
          throw new MedicationRepositoryError('Không tìm thấy thuốc cần chỉnh sửa.');
        }

        transaction.update(reference, {
          ...input,
          revision: readStoredRevision(current.data()) + 1,
          updatedAt: serverTimestamp(),
        });
      });

      return getRequiredDocument(ownerUid, medicationId, 'Không thể xác nhận thuốc vừa cập nhật.');
    },
    async markMedicationInactiveDocument(ownerUid, medicationId) {
      const reference = medicationReference(ownerUid, medicationId);

      await runTransaction(resolvedFirestore, async (transaction) => {
        const current = await transaction.get(reference);

        if (!current.exists()) {
          throw new MedicationRepositoryError('Không tìm thấy thuốc cần ngừng sử dụng.');
        }

        if (readStoredStatus(current.data()) === 'inactive') {
          return;
        }

        transaction.update(reference, {
          status: 'inactive',
          revision: readStoredRevision(current.data()) + 1,
          updatedAt: serverTimestamp(),
        });
      });

      return getRequiredDocument(ownerUid, medicationId, 'Không thể xác nhận trạng thái thuốc.');
    },
  };
}

/**
 * Firestore implementation for M3.2. The legacy interface still receives a
 * session UID from the store, but each operation verifies it against Firebase
 * Auth before deriving the only document path it can access.
 */
export class FirestoreMedicationRepository implements MedicationRepository {
  constructor(
    private readonly medicationPort: FirestoreMedicationPort = createFirestoreMedicationPort(),
  ) {}

  async listMedications(
    userId: string,
    { status = 'all' }: MedicationListOptions = {},
  ): Promise<Medication[]> {
    try {
      const ownerUid = requireCurrentAuthOwner(this.medicationPort, userId);
      const documents = await this.medicationPort.listMedicationDocuments(ownerUid);
      requireCurrentAuthOwner(this.medicationPort, ownerUid);

      return documents
        .map((document) => mapFirestoreMedicationDocument(document, ownerUid))
        .filter((medication) => status === 'all' || medication.status === status);
    } catch (error) {
      throw mapMedicationRepositoryError(error);
    }
  }

  async getActiveMedications(userId: string): Promise<Medication[]> {
    return this.listMedications(userId, { status: 'active' });
  }

  async getMedicationById(userId: string, medicationId: string): Promise<Medication | null> {
    try {
      const ownerUid = requireCurrentAuthOwner(this.medicationPort, userId);
      const safeMedicationId = normalizeMedicationId(medicationId);
      const document = await this.medicationPort.getMedicationDocument(ownerUid, safeMedicationId);
      requireCurrentAuthOwner(this.medicationPort, ownerUid);

      return document ? mapFirestoreMedicationDocument(document, ownerUid) : null;
    } catch (error) {
      throw mapMedicationRepositoryError(error);
    }
  }

  async createMedication(userId: string, input: MedicationInput): Promise<Medication> {
    try {
      const ownerUid = requireCurrentAuthOwner(this.medicationPort, userId);
      const normalizedInput = assertValidMedicationInput(input);
      const document = await this.medicationPort.createMedicationDocument(ownerUid, normalizedInput);
      requireCurrentAuthOwner(this.medicationPort, ownerUid);
      return mapFirestoreMedicationDocument(document, ownerUid);
    } catch (error) {
      throw mapMedicationRepositoryError(error);
    }
  }

  async updateMedication(userId: string, medicationId: string, input: MedicationInput): Promise<Medication> {
    try {
      const ownerUid = requireCurrentAuthOwner(this.medicationPort, userId);
      const safeMedicationId = normalizeMedicationId(medicationId);
      const normalizedInput = assertValidMedicationInput(input);
      const document = await this.medicationPort.updateMedicationDocument(ownerUid, safeMedicationId, normalizedInput);
      requireCurrentAuthOwner(this.medicationPort, ownerUid);
      return mapFirestoreMedicationDocument(document, ownerUid);
    } catch (error) {
      throw mapMedicationRepositoryError(error);
    }
  }

  async markMedicationInactive(userId: string, medicationId: string): Promise<Medication> {
    try {
      const ownerUid = requireCurrentAuthOwner(this.medicationPort, userId);
      const safeMedicationId = normalizeMedicationId(medicationId);
      const document = await this.medicationPort.markMedicationInactiveDocument(ownerUid, safeMedicationId);
      requireCurrentAuthOwner(this.medicationPort, ownerUid);
      return mapFirestoreMedicationDocument(document, ownerUid);
    } catch (error) {
      throw mapMedicationRepositoryError(error);
    }
  }
}

let firestoreMedicationRepository: FirestoreMedicationRepository | null = null;

export function getFirestoreMedicationRepository(): FirestoreMedicationRepository {
  firestoreMedicationRepository ??= new FirestoreMedicationRepository();
  return firestoreMedicationRepository;
}

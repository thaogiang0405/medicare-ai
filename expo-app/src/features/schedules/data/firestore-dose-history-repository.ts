import type { Auth } from 'firebase/auth';
import {
  collection,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type Firestore,
  type QueryConstraint,
} from 'firebase/firestore';

import {
  DoseEventRepositoryError,
  mapFirestoreDoseEventDocument,
  type FirestoreDoseEventDocument,
} from './firestore-dose-event-repository';
import {
  getDoseHistoryCursor,
  normalizeDoseHistoryQuery,
  type DoseHistoryPage,
  type DoseHistoryQuery,
  type DoseHistoryRepository,
} from '../domain/dose-history-repository';

type FirebaseDoseHistoryUser = Readonly<{ uid: string }>;

export type FirestoreDoseHistoryPort = {
  getCurrentAuthUser(): FirebaseDoseHistoryUser | null;
  listDoseHistoryDocuments(
    ownerUid: string,
    query: DoseHistoryQuery,
  ): Promise<readonly FirestoreDoseEventDocument[]>;
};

function requireCurrentAuthOwner(port: FirestoreDoseHistoryPort, suppliedUserId: string): string {
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

function mapHistoryError(error: unknown): Error {
  if (error instanceof DoseEventRepositoryError) {
    return error;
  }

  if (getFirebaseErrorCode(error) === 'permission-denied') {
    return new DoseEventRepositoryError('Bạn không có quyền xem lịch sử uống thuốc này.');
  }

  if (getFirebaseErrorCode(error) === 'unavailable') {
    return new DoseEventRepositoryError('Không thể kết nối Firebase. Vui lòng kiểm tra mạng rồi thử lại.');
  }

  return new DoseEventRepositoryError('Không thể tải lịch sử uống thuốc. Vui lòng thử lại.');
}

function getFirebaseDoseHistoryComposition(): {
  getFirebaseAuth: () => Auth;
  getFirebaseFirestore: () => Firestore;
} {
  // Keep Firebase composition behind the explicit feature-flagged boundary.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/services/firebase');
}

function createFirestoreDoseHistoryPort(auth?: Auth, firestore?: Firestore): FirestoreDoseHistoryPort {
  const firebase = (!auth || !firestore) ? getFirebaseDoseHistoryComposition() : null;
  const resolvedAuth = auth ?? firebase!.getFirebaseAuth();
  const resolvedFirestore = firestore ?? firebase!.getFirebaseFirestore();
  const doseEventsCollection = (ownerUid: string) =>
    collection(resolvedFirestore, 'elderlyProfiles', ownerUid, 'doseEvents');

  return {
    getCurrentAuthUser: () => (resolvedAuth.currentUser ? { uid: resolvedAuth.currentUser.uid } : null),
    async listDoseHistoryDocuments(ownerUid, input) {
      const safeQuery = normalizeDoseHistoryQuery(input);
      const constraints: QueryConstraint[] = [
        where('scheduledLocalDate', '>=', safeQuery.startLocalDate),
        where('scheduledLocalDate', '<=', safeQuery.endLocalDate),
        orderBy('scheduledLocalDate', 'desc'),
        orderBy('scheduledLocalTime', 'desc'),
        orderBy(documentId(), 'desc'),
      ];

      if (safeQuery.cursor) {
        constraints.push(startAfter(
          safeQuery.cursor.scheduledLocalDate,
          safeQuery.cursor.scheduledLocalTime,
          safeQuery.cursor.id,
        ));
      }

      constraints.push(limit(safeQuery.pageSize));
      const snapshot = await getDocs(query(doseEventsCollection(ownerUid), ...constraints));
      return snapshot.docs.map((document) => ({ id: document.id, data: document.data() }));
    },
  };
}

/**
 * Owner-scoped, bounded Firestore history reader. The parent document path is
 * derived from Firebase Auth; UI-provided UIDs never select a different path.
 */
export class FirestoreDoseHistoryRepository implements DoseHistoryRepository {
  constructor(private readonly port: FirestoreDoseHistoryPort = createFirestoreDoseHistoryPort()) {}

  async listDoseHistory(userId: string, input: DoseHistoryQuery): Promise<DoseHistoryPage> {
    try {
      const ownerUid = requireCurrentAuthOwner(this.port, userId);
      const safeQuery = normalizeDoseHistoryQuery(input);
      const documents = await this.port.listDoseHistoryDocuments(ownerUid, safeQuery);
      requireCurrentAuthOwner(this.port, ownerUid);
      const events = documents.map((document) => mapFirestoreDoseEventDocument(document, ownerUid));
      const nextCursor = events.length === safeQuery.pageSize
        ? getDoseHistoryCursor(events[events.length - 1]!)
        : null;

      return { events, nextCursor };
    } catch (error) {
      throw mapHistoryError(error);
    }
  }
}

let firestoreDoseHistoryRepository: FirestoreDoseHistoryRepository | null = null;

export function getFirestoreDoseHistoryRepository(): FirestoreDoseHistoryRepository {
  firestoreDoseHistoryRepository ??= new FirestoreDoseHistoryRepository();
  return firestoreDoseHistoryRepository;
}

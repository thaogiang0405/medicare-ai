import type { Auth } from 'firebase/auth';
import { getFunctions, httpsCallable, type Functions } from 'firebase/functions';

import type {
  PrescriptionImageMimeType,
  PrescriptionOcrGateway,
  PrescriptionOcrPage,
  PrescriptionOcrRequest,
  PrescriptionOcrResult,
} from '../domain/prescription-ocr';
import { validatePrescriptionOcrRequest } from '../domain/prescription-ocr';
import { PrescriptionOcrError, toPrescriptionOcrError } from './prescription-ocr-errors';

export const prescriptionOcrCallableName = 'recognizePrescription';
export const prescriptionOcrCallableRegion = 'asia-east1';

type FirebaseOcrUser = Readonly<{ uid: string }>;

type PrescriptionOcrCallableRequest = Readonly<{
  consentAccepted: true;
  pages: readonly Readonly<{
    pageIndex: number;
    mimeType: PrescriptionImageMimeType;
    base64: string;
    byteSize: number;
  }>[];
}>;

export type FirebasePrescriptionOcrPort = {
  getCurrentAuthUser(): FirebaseOcrUser | null;
  invokeCallable(request: PrescriptionOcrCallableRequest): Promise<unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  if (typeof value !== 'string') {
    throw new PrescriptionOcrError('internal', 'Dịch vụ quét đơn thuốc trả về dữ liệu không hợp lệ.');
  }

  return value;
}

function readWarnings(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some((warning) => typeof warning !== 'string' || warning.length > 500)) {
    throw new PrescriptionOcrError('internal', 'Dịch vụ quét đơn thuốc trả về dữ liệu không hợp lệ.');
  }

  return value.map((warning) => warning.trim()).filter(Boolean);
}

function readConfidence(value: unknown): number | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new PrescriptionOcrError('internal', 'Dịch vụ quét đơn thuốc trả về dữ liệu không hợp lệ.');
  }

  return value;
}

/** Maps the untrusted callable DTO without retaining unexpected provider data. */
export function mapPrescriptionOcrCallableResponse(value: unknown): PrescriptionOcrResult {
  if (!isRecord(value)) {
    throw new PrescriptionOcrError('internal', 'Dịch vụ quét đơn thuốc trả về dữ liệu không hợp lệ.');
  }

  if (value.provider !== 'google-cloud-vision') {
    throw new PrescriptionOcrError('internal', 'Dịch vụ quét đơn thuốc trả về nguồn dữ liệu không hợp lệ.');
  }

  if (!Array.isArray(value.pages) || value.pages.length < 1 || value.pages.length > 3) {
    throw new PrescriptionOcrError('internal', 'Dịch vụ quét đơn thuốc trả về dữ liệu không hợp lệ.');
  }

  const seenPageIndexes = new Set<number>();
  const pages: PrescriptionOcrPage[] = value.pages.map((item) => {
    if (!isRecord(item)) {
      throw new PrescriptionOcrError('internal', 'Dịch vụ quét đơn thuốc trả về dữ liệu không hợp lệ.');
    }
    const pageIndex = item.pageIndex;
    if (!Number.isInteger(pageIndex) || typeof pageIndex !== 'number' || pageIndex < 0 || pageIndex > 2) {
      throw new PrescriptionOcrError('internal', 'Dịch vụ quét đơn thuốc trả về dữ liệu không hợp lệ.');
    }

    if (seenPageIndexes.has(pageIndex)) {
      throw new PrescriptionOcrError('internal', 'Dịch vụ quét đơn thuốc trả về dữ liệu không hợp lệ.');
    }
    seenPageIndexes.add(pageIndex);

    const text = readString(item.text);
    if (text.length > 100_000) {
      throw new PrescriptionOcrError('internal', 'Dữ liệu quét đơn thuốc vượt giới hạn an toàn.');
    }

    return {
      pageIndex,
      text,
      confidence: readConfidence(item.confidence),
      qualityWarnings: readWarnings(item.qualityWarnings),
    };
  });

  return { pages: pages.sort((left, right) => left.pageIndex - right.pageIndex), provider: 'google-cloud-vision' };
}

function requireCurrentUser(port: FirebasePrescriptionOcrPort, expectedUserId: string): string {
  const suppliedUid = expectedUserId.trim();
  const currentUid = port.getCurrentAuthUser()?.uid;

  if (!suppliedUid || !currentUid || currentUid !== suppliedUid) {
    throw new PrescriptionOcrError('unauthenticated', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  return currentUid;
}

function getFirebaseOcrComposition(): {
  getFirebaseApp: () => import('firebase/app').FirebaseApp;
  getFirebaseAuth: () => Auth;
} {
  // Keep the native Auth boundary lazy. Merely importing OCR types must not
  // initialize Firebase or access any native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/services/firebase');
}

function createFirebasePrescriptionOcrPort(
  auth?: Auth,
  functions?: Functions,
): FirebasePrescriptionOcrPort {
  const firebase = (!auth || !functions) ? getFirebaseOcrComposition() : null;
  const resolvedAuth = auth ?? firebase!.getFirebaseAuth();
  const resolvedFunctions = functions ?? getFunctions(firebase!.getFirebaseApp(), prescriptionOcrCallableRegion);
  const callable = httpsCallable<PrescriptionOcrCallableRequest, unknown>(
    resolvedFunctions,
    prescriptionOcrCallableName,
    { timeout: 60_000 },
  );

  return {
    getCurrentAuthUser: () => (resolvedAuth.currentUser ? { uid: resolvedAuth.currentUser.uid } : null),
    async invokeCallable(request) {
      const response = await callable(request);
      return response.data;
    },
  };
}

/**
 * The production OCR boundary calls an authenticated Firebase callable. The
 * UID is checked both before and after the request to prevent a late response
 * from being shown after logout or account switching.
 */
export class FirebasePrescriptionOcrGateway implements PrescriptionOcrGateway {
  constructor(private readonly port: FirebasePrescriptionOcrPort = createFirebasePrescriptionOcrPort()) {}

  async recognizePrescription(userId: string, input: PrescriptionOcrRequest): Promise<PrescriptionOcrResult> {
    try {
      const ownerUid = requireCurrentUser(this.port, userId);
      let request: PrescriptionOcrRequest;
      try {
        request = validatePrescriptionOcrRequest(input);
      } catch (error) {
        throw new PrescriptionOcrError(
          'invalid-argument',
          error instanceof Error ? error.message : 'Ảnh đơn thuốc không hợp lệ hoặc vượt giới hạn cho phép.',
        );
      }
      const response = await this.port.invokeCallable({
        consentAccepted: true,
        pages: request.pages.map((page, pageIndex) => ({
          pageIndex,
          mimeType: page.mimeType,
          base64: page.base64,
          byteSize: page.byteSize,
        })),
      });
      requireCurrentUser(this.port, ownerUid);
      return mapPrescriptionOcrCallableResponse(response);
    } catch (error) {
      throw toPrescriptionOcrError(error);
    }
  }
}

let firebasePrescriptionOcrGateway: FirebasePrescriptionOcrGateway | null = null;

export function getFirebasePrescriptionOcrGateway(): FirebasePrescriptionOcrGateway {
  firebasePrescriptionOcrGateway ??= new FirebasePrescriptionOcrGateway();
  return firebasePrescriptionOcrGateway;
}

/**
 * Test-only gateway. It has synthetic text, declares itself `demo`, and is
 * never selected by production composition or silently presented as real OCR.
 */
export class DemoPrescriptionOcrGateway implements PrescriptionOcrGateway {
  async recognizePrescription(userId: string, request: PrescriptionOcrRequest): Promise<PrescriptionOcrResult> {
    if (!userId.trim()) {
      throw new PrescriptionOcrError('unauthenticated', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    const safeRequest = validatePrescriptionOcrRequest(request);
    return {
      provider: 'demo',
      pages: safeRequest.pages.map((_, pageIndex) => ({
        pageIndex,
        text: 'ĐƠN THUỐC MÔ PHỎNG\n1. Paracetamol 500 mg - uống khi cần theo đơn đã xác nhận',
        confidence: null,
        qualityWarnings: ['Kết quả mô phỏng dành cho kiểm thử; không phải OCR thật.'],
      })),
    };
  }
}

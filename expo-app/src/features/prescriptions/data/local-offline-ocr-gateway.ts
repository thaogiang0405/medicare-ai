import type {
  PrescriptionOcrExecutionOptions,
  PrescriptionOcrGateway,
  PrescriptionOcrImagePage,
  PrescriptionOcrRequest,
  PrescriptionOcrResult,
} from '../domain/prescription-ocr';
import { prescriptionOcrMaximumPages, validatePrescriptionOcrRequest } from '../domain/prescription-ocr';
import {
  getLocalOfflineOcrPort,
  type LocalOfflineOcrPageResult,
  type LocalOfflineOcrPort,
} from './local-offline-ocr-bridge';
import { PrescriptionOcrError, toPrescriptionOcrError } from './prescription-ocr-errors';

type AuthenticatedUserIdReader = () => string | null;
type LocalOfflineOcrPortReader = () => LocalOfflineOcrPort | null;

function getCurrentFirebaseAuthUserId(): string | null {
  // Local OCR never imports Firebase Functions. Auth is read only to ensure a
  // caller cannot process a draft under a UID supplied by the UI.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getFirebaseAuth } = require('@/services/firebase') as typeof import('@/services/firebase');
  return getFirebaseAuth().currentUser?.uid ?? null;
}

function requireCurrentUser(expectedUserId: string, getCurrentUserId: AuthenticatedUserIdReader): string {
  const expected = expectedUserId.trim();
  const current = getCurrentUserId()?.trim() ?? '';

  if (!expected || !current || current !== expected) {
    throw new PrescriptionOcrError('unauthenticated', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  return current;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new PrescriptionOcrError('cancelled', 'Đã dừng nhận dạng ảnh đơn thuốc.');
  }
}

function validatePageResult(value: LocalOfflineOcrPageResult): LocalOfflineOcrPageResult {
  if (typeof value.text !== 'string' || value.text.length > 100_000) {
    throw new PrescriptionOcrError('internal', 'Bộ nhận dạng trên thiết bị trả về dữ liệu không hợp lệ.');
  }

  if (value.confidence !== null && (!Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1)) {
    throw new PrescriptionOcrError('internal', 'Bộ nhận dạng trên thiết bị trả về dữ liệu không hợp lệ.');
  }

  if (!Array.isArray(value.qualityWarnings) || value.qualityWarnings.some((warning) => typeof warning !== 'string' || warning.length > 500)) {
    throw new PrescriptionOcrError('internal', 'Bộ nhận dạng trên thiết bị trả về dữ liệu không hợp lệ.');
  }

  return {
    text: value.text,
    confidence: value.confidence,
    qualityWarnings: value.qualityWarnings.map((warning) => warning.trim()).filter(Boolean),
  };
}

function toBridgePage(page: PrescriptionOcrImagePage, pageIndex: number) {
  return {
    id: page.id,
    pageIndex,
    mimeType: page.mimeType,
    base64: page.base64,
  } as const;
}

/**
 * Processes one already-sanitized page at a time in the DOM/WebView runtime.
 * This module intentionally has no HTTP, Functions, Storage, or OCR-service
 * imports. Raw images/text remain transient in the caller and DOM worker.
 */
export class LocalOfflineOcrGateway implements PrescriptionOcrGateway {
  constructor(
    private readonly getPort: LocalOfflineOcrPortReader = getLocalOfflineOcrPort,
    private readonly getCurrentUserId: AuthenticatedUserIdReader = getCurrentFirebaseAuthUserId,
  ) {}

  async recognizePrescription(
    userId: string,
    input: PrescriptionOcrRequest,
    options: PrescriptionOcrExecutionOptions = {},
  ): Promise<PrescriptionOcrResult> {
    try {
      const ownerUid = requireCurrentUser(userId, this.getCurrentUserId);
      throwIfAborted(options.signal);

      let request: PrescriptionOcrRequest;
      try {
        request = validatePrescriptionOcrRequest(input);
      } catch (error) {
        throw new PrescriptionOcrError(
          'invalid-argument',
          error instanceof Error ? error.message : 'Ảnh đơn thuốc không hợp lệ hoặc vượt giới hạn cho phép.',
        );
      }

      const port = this.getPort();
      if (!port || !port.isReady()) {
        throw new PrescriptionOcrError(
          'unavailable',
          'Bộ nhận dạng chữ trên thiết bị chưa sẵn sàng. Bạn có thể thử lại hoặc thêm thuốc thủ công.',
        );
      }

      const pages = [];
      for (const [pageIndex, page] of request.pages.entries()) {
        throwIfAborted(options.signal);
        options.onProgress?.({
          pageIndex,
          totalPages: request.pages.length,
          phase: 'preparing',
          progress: 0,
        });

        const result = validatePageResult(await port.recognizePage(toBridgePage(page, pageIndex), {
          signal: options.signal,
          onProgress: (progress) => options.onProgress?.({
            pageIndex,
            totalPages: request.pages.length,
            phase: progress.phase,
            progress: progress.progress,
          }),
        }));

        throwIfAborted(options.signal);
        requireCurrentUser(ownerUid, this.getCurrentUserId);
        pages.push({ pageIndex, ...result });
      }

      if (pages.length < 1 || pages.length > prescriptionOcrMaximumPages) {
        throw new PrescriptionOcrError('internal', 'Bộ nhận dạng trên thiết bị trả về dữ liệu không hợp lệ.');
      }

      return { pages, provider: 'local-offline' };
    } catch (error) {
      throw toPrescriptionOcrError(error);
    }
  }
}

let localOfflineOcrGateway: LocalOfflineOcrGateway | null = null;

export function getLocalOfflineOcrGateway(): LocalOfflineOcrGateway {
  localOfflineOcrGateway ??= new LocalOfflineOcrGateway();
  return localOfflineOcrGateway;
}

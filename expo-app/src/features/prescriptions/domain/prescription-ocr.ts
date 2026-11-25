import type { MedicationInput } from '@/features/medications/domain/medication-repository';

/** Conservative client-side ceilings that protect local device memory. */
export const prescriptionOcrMaximumPages = 3;
export const prescriptionOcrMaximumPageBytes = 5 * 1024 * 1024;
export const prescriptionOcrMaximumRequestBytes = 10 * 1024 * 1024;

export const supportedPrescriptionImageMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type PrescriptionImageMimeType = (typeof supportedPrescriptionImageMimeTypes)[number];

export type PrescriptionOcrPage = Readonly<{
  pageIndex: number;
  /** Raw recognized text. It remains in memory only. */
  text: string;
  confidence: number | null;
  qualityWarnings: readonly string[];
}>;

/**
 * Image data is deliberately transient. Never persist this shape in
 * AsyncStorage, Firestore, analytics, or logs.
 */
export type PrescriptionOcrImagePage = Readonly<{
  id: string;
  uri: string;
  mimeType: PrescriptionImageMimeType;
  byteSize: number;
  width: number;
  height: number;
  /** Normalized base64 bytes without a data URI prefix or EXIF metadata. */
  base64: string;
  qualityWarnings: readonly string[];
}>;

export type PrescriptionOcrCandidate = Readonly<{
  id: string;
  pageIndex: number;
  input: MedicationInput;
  /** Original OCR line(s), kept only for the active review session. */
  sourceText: string;
  /** Human-readable source reference, for example “Trang 1, dòng 3”. */
  sourceReference: string;
  warnings: readonly string[];
}>;

export type PrescriptionOcrRequest = Readonly<{
  /** User acknowledgement before transient, on-device image processing begins. */
  consentAccepted: true;
  pages: readonly PrescriptionOcrImagePage[];
}>;

export type PrescriptionOcrResult = Readonly<{
  pages: readonly PrescriptionOcrPage[];
  provider: 'google-cloud-vision' | 'local-offline' | 'demo' | 'manual-import';
}>;

export type PrescriptionOcrProgressPhase =
  | 'preparing'
  | 'loading-engine'
  | 'loading-language'
  | 'recognizing'
  | 'finalizing';

/** Progress is ephemeral and deliberately excludes raw image/text data. */
export type PrescriptionOcrProgress = Readonly<{
  pageIndex: number;
  totalPages: number;
  phase: PrescriptionOcrProgressPhase;
  progress: number | null;
}>;

export type PrescriptionOcrExecutionOptions = Readonly<{
  /** Cancels the active local worker without retaining its image/text payload. */
  signal?: AbortSignal;
  /** Choose safe package-label reading only for the packaging screen. */
  sourceMode?: 'prescription' | 'packaging';
  onProgress?: (progress: PrescriptionOcrProgress) => void;
}>;

/**
 * Boundary for transient prescription OCR. Implementations must verify the
 * authenticated owner independently; a UI-supplied UID is never authority.
 */
export interface PrescriptionOcrGateway {
  recognizePrescription(
    userId: string,
    request: PrescriptionOcrRequest,
    options?: PrescriptionOcrExecutionOptions,
  ): Promise<PrescriptionOcrResult>;
}

function isSupportedMimeType(value: string): value is PrescriptionImageMimeType {
  return (supportedPrescriptionImageMimeTypes as readonly string[]).includes(value);
}

function normalizePageId(value: string): string {
  const normalized = value.trim();

  if (!normalized || normalized.length > 150 || normalized.includes('/')) {
    throw new Error('Trang ảnh đơn thuốc không hợp lệ. Vui lòng chọn lại ảnh.');
  }

  return normalized;
}

function normalizeBase64(value: string): string {
  const normalized = value.replace(/\s/g, '');

  if (!normalized || normalized.startsWith('data:') || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new Error('Dữ liệu ảnh đơn thuốc không hợp lệ. Vui lòng chọn lại ảnh.');
  }

  return normalized;
}

/** Validates the input before any image bytes leave the device. */
export function validatePrescriptionOcrRequest(request: PrescriptionOcrRequest): PrescriptionOcrRequest {
  if (request.consentAccepted !== true) {
    throw new Error('Vui lòng xác nhận xử lý ảnh đơn thuốc trên thiết bị trước khi quét.');
  }

  if (!Array.isArray(request.pages) || request.pages.length < 1 || request.pages.length > prescriptionOcrMaximumPages) {
    throw new Error(`Mỗi lần chỉ có thể quét từ 1 đến ${prescriptionOcrMaximumPages} trang đơn thuốc.`);
  }

  const seenIds = new Set<string>();
  let totalBytes = 0;
  const pages = request.pages.map((page) => {
    const id = normalizePageId(page.id);

    if (seenIds.has(id)) {
      throw new Error('Có trang ảnh bị trùng. Vui lòng kiểm tra lại đơn thuốc.');
    }
    seenIds.add(id);

    if (!isSupportedMimeType(page.mimeType)) {
      throw new Error('Định dạng ảnh không được hỗ trợ. Hãy dùng JPEG, PNG hoặc WebP.');
    }

    if (!Number.isInteger(page.byteSize) || page.byteSize < 1 || page.byteSize > prescriptionOcrMaximumPageBytes) {
      throw new Error('Một trang đơn thuốc quá lớn. Vui lòng chụp lại ảnh rõ hơn với kích thước nhỏ hơn.');
    }

    if (!Number.isInteger(page.width) || page.width < 1 || !Number.isInteger(page.height) || page.height < 1) {
      throw new Error('Kích thước ảnh đơn thuốc không hợp lệ. Vui lòng chụp hoặc chọn lại ảnh.');
    }

    totalBytes += page.byteSize;

    return {
      ...page,
      id,
      base64: normalizeBase64(page.base64),
      qualityWarnings: [...page.qualityWarnings],
    };
  });

  if (totalBytes > prescriptionOcrMaximumRequestBytes) {
    throw new Error('Tổng kích thước ảnh đơn thuốc quá lớn. Vui lòng bỏ bớt trang hoặc chụp lại ảnh nhỏ hơn.');
  }

  return { consentAccepted: true, pages };
}

export function isPrescriptionOcrCandidateReady(candidate: PrescriptionOcrCandidate): boolean {
  return candidate.input.name.trim().length > 0;
}

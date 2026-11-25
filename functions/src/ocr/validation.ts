import { HttpsError } from 'firebase-functions/v2/https';

import {
  MAX_OCR_PAGES,
  MAX_OCR_PAGE_BYTES,
  MAX_OCR_TOTAL_BYTES,
  OcrPageInput,
  SupportedOcrMimeType,
  supportedOcrMimeTypes,
  ValidatedOcrPage,
  ValidatedOcrRequest,
} from './contracts';
import { invalidRequest } from './errors';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSupportedMimeType(value: unknown): value is SupportedOcrMimeType {
  return (
    typeof value === 'string' &&
    (supportedOcrMimeTypes as readonly string[]).includes(value)
  );
}

function isStrictBase64(value: string): boolean {
  if (value.length === 0 || value.length % 4 !== 0) {
    return false;
  }

  return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function matchesMimeMagic(bytes: Buffer, mimeType: SupportedOcrMimeType): boolean {
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (mimeType === 'image/png') {
    const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return pngSignature.every((byte, index) => bytes[index] === byte);
  }

  // WebP starts with RIFF....WEBP. The client still strips EXIF before sending.
  return (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

function decodePage(rawPage: unknown): ValidatedOcrPage {
  if (!isRecord(rawPage)) {
    throw invalidRequest('Mỗi trang đơn thuốc phải có định dạng hợp lệ.');
  }

  const pageIndex = rawPage.pageIndex;
  const mimeType = rawPage.mimeType;
  const base64 = rawPage.base64;
  const byteSize = rawPage.byteSize;

  if (
    typeof pageIndex !== 'number' ||
    !Number.isSafeInteger(pageIndex) ||
    pageIndex < 0 ||
    pageIndex >= MAX_OCR_PAGES
  ) {
    throw invalidRequest('Thứ tự trang đơn thuốc không hợp lệ.');
  }

  if (!isSupportedMimeType(mimeType)) {
    throw invalidRequest('Định dạng ảnh đơn thuốc không được hỗ trợ.');
  }

  if (typeof base64 !== 'string' || !isStrictBase64(base64)) {
    throw invalidRequest('Dữ liệu ảnh đơn thuốc không hợp lệ.');
  }

  const maxBase64Length = Math.ceil(MAX_OCR_PAGE_BYTES / 3) * 4 + 4;
  if (base64.length > maxBase64Length) {
    throw invalidRequest('Một ảnh đơn thuốc vượt quá giới hạn cho phép.');
  }

  if (
    typeof byteSize !== 'number' ||
    !Number.isSafeInteger(byteSize) ||
    byteSize <= 0 ||
    byteSize > MAX_OCR_PAGE_BYTES
  ) {
    throw invalidRequest('Kích thước ảnh đơn thuốc không hợp lệ.');
  }

  const bytes = Buffer.from(base64, 'base64');
  const canonicalBase64 = bytes.toString('base64').replace(/=+$/, '');
  if (bytes.length === 0 || canonicalBase64 !== base64.replace(/=+$/, '')) {
    throw invalidRequest('Dữ liệu ảnh đơn thuốc không hợp lệ.');
  }

  if (bytes.length !== byteSize || bytes.length > MAX_OCR_PAGE_BYTES) {
    throw invalidRequest('Kích thước ảnh đơn thuốc không khớp hoặc vượt giới hạn.');
  }

  if (!matchesMimeMagic(bytes, mimeType)) {
    throw invalidRequest('Nội dung ảnh đơn thuốc không khớp với định dạng đã khai báo.');
  }

  return { pageIndex, mimeType, bytes };
}

/**
 * Validates a compact callable payload. The image bytes are never persisted or
 * logged; they live only for the request lifetime.
 */
export function validateOcrPayload(data: unknown): ValidatedOcrRequest {
  if (!isRecord(data) || data.consentAccepted !== true) {
    throw new HttpsError(
      'failed-precondition',
      'Cần đồng ý gửi ảnh đơn thuốc tới Google Cloud để thực hiện OCR.',
    );
  }

  if (!Array.isArray(data.pages) || data.pages.length === 0 || data.pages.length > MAX_OCR_PAGES) {
    throw invalidRequest(`Chỉ hỗ trợ từ 1 đến ${MAX_OCR_PAGES} trang đơn thuốc mỗi lần.`);
  }

  const pages = data.pages.map(decodePage);
  const pageIndexes = new Set<number>();
  let totalBytes = 0;

  for (const page of pages) {
    if (pageIndexes.has(page.pageIndex)) {
      throw invalidRequest('Các trang đơn thuốc không được trùng thứ tự.');
    }

    pageIndexes.add(page.pageIndex);
    totalBytes += page.bytes.length;
  }

  if (totalBytes > MAX_OCR_TOTAL_BYTES) {
    throw invalidRequest('Tổng kích thước ảnh đơn thuốc vượt quá giới hạn cho phép.');
  }

  return {
    pages: [...pages].sort((first, second) => first.pageIndex - second.pageIndex),
  };
}

/** Exposed for tests and documentation of the callable wire contract. */
export type PrescriptionOcrWirePage = OcrPageInput;

import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import {
  prescriptionOcrMaximumPageBytes,
  type PrescriptionOcrImagePage,
} from '../domain/prescription-ocr';

/**
 * Images are re-encoded into the app cache before OCR. This corrects display
 * orientation and deliberately omits picker EXIF metadata from the OCR payload.
 * The output stays local until the user gives explicit cloud-processing consent.
 */
export const prescriptionImageMaximumDimension = 2_000;
export const prescriptionImageCompression = 0.78;
const lowResolutionThreshold = 900;

export type PickedPrescriptionImage = Readonly<{
  uri: string;
  width?: number | null;
  height?: number | null;
}>;

function newPageId(): string {
  return `prescription-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function pageWarnings(width: number, height: number): string[] {
  const shortestEdge = Math.min(width, height);
  return shortestEdge < lowResolutionThreshold
    ? ['Ảnh có độ phân giải thấp, chữ có thể khó đọc. Hãy kiểm tra lại kết quả OCR.']
    : [];
}

function assertFileSize(byteSize: number): void {
  if (!Number.isInteger(byteSize) || byteSize < 1) {
    throw new Error('Không thể đọc ảnh đơn thuốc. Vui lòng chọn hoặc quét lại ảnh.');
  }

  if (byteSize > prescriptionOcrMaximumPageBytes) {
    throw new Error('Ảnh đơn thuốc vẫn quá lớn sau khi tối ưu. Vui lòng chụp lại ảnh rõ hơn hoặc chọn ảnh khác.');
  }
}

/**
 * Produces a compact JPEG page with no exposed EXIF object or original
 * picker metadata. The returned base64 is ephemeral and must never be stored
 * in AsyncStorage, analytics, Firestore, or logs.
 */
export async function preparePrescriptionImage(
  source: PickedPrescriptionImage,
): Promise<PrescriptionOcrImagePage> {
  if (!source.uri.trim()) {
    throw new Error('Ảnh đơn thuốc không hợp lệ. Vui lòng chọn hoặc quét lại ảnh.');
  }

  try {
    const context = ImageManipulator.manipulate(source.uri, {
      maxWidth: prescriptionImageMaximumDimension,
      maxHeight: prescriptionImageMaximumDimension,
    });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({
      base64: false,
      compress: prescriptionImageCompression,
      format: SaveFormat.JPEG,
    });
    const file = new File(saved.uri);
    const byteSize = file.size;
    assertFileSize(byteSize);
    const base64 = await file.base64();

    if (!base64.trim()) {
      throw new Error('Không thể đọc ảnh đơn thuốc. Vui lòng chọn hoặc quét lại ảnh.');
    }

    return {
      id: newPageId(),
      uri: saved.uri,
      mimeType: 'image/jpeg',
      byteSize,
      width: saved.width,
      height: saved.height,
      base64,
      qualityWarnings: pageWarnings(saved.width, saved.height),
    };
  } catch (error) {
    if (error instanceof Error && error.message) {
      throw error;
    }
    throw new Error('Không thể tối ưu ảnh đơn thuốc. Vui lòng thử lại với ảnh khác.');
  }
}

/** Best-effort cleanup for cache files created by `preparePrescriptionImage`. */
export function deleteTemporaryPrescriptionImages(
  pages: readonly Pick<PrescriptionOcrImagePage, 'uri'>[],
): void {
  deleteTemporaryPrescriptionUris(pages.map((page) => page.uri));
}

/** Used for cache-only scanner source pages after they have been re-encoded. */
export function deleteTemporaryPrescriptionUris(uris: readonly string[]): void {
  uris.forEach((uri) => {
    // Do not attempt to delete original Photos/content URIs. Only this module's
    // re-encoded cache output is expected to be a file URI.
    if (!uri.startsWith('file://')) {
      return;
    }

    try {
      const file = new File(uri);
      if (file.exists) {
        file.delete();
      }
    } catch {
      // Cache cleanup must never block logout, cancellation, or a safer retry.
    }
  });
}

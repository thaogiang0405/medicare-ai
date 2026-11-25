import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import {
  prescriptionOcrMaximumPageBytes,
  type PrescriptionOcrImagePage,
} from '../domain/prescription-ocr';

/**
 * Images are re-encoded into the app cache before OCR. This corrects display
 * orientation and deliberately omits picker EXIF metadata from the OCR payload.
 * The output stays local while the user reviews on-device OCR.
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
  // A deliberately cropped wide label can be short but still contain large,
  // legible medicine lettering; do not mislabel it as a low-resolution photo.
  if (width >= lowResolutionThreshold && width / height >= 2.3) return [];
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

/**
 * Crop a narrow horizontal band around the exact label position selected by
 * the user. This is a guided reading tool, not automatic pill identification.
 * The band remains local and can be reselected if it misses any letters.
 */
export async function cropPrescriptionImageToNameBand(
  page: PrescriptionOcrImagePage,
  relativeCenterY: number,
): Promise<PrescriptionOcrImagePage> {
  if (!Number.isFinite(relativeCenterY) || relativeCenterY < 0 || relativeCenterY > 1) {
    throw new Error('Vị trí dòng tên thuốc không hợp lệ. Hãy chạm lại vào ảnh.');
  }
  if (!Number.isInteger(page.width) || !Number.isInteger(page.height) || page.width < 200 || page.height < 200) {
    throw new Error('Kích thước ảnh không phù hợp để chọn vùng tên thuốc.');
  }

  // A normal package photo needs a narrow band to exclude marketing copy;
  // an already horizontally cropped label needs enough height for slanted type.
  const fraction = page.width / page.height >= 2.3 ? 0.42 : 0.15;
  const height = Math.min(page.height, Math.max(100, Math.floor(page.height * fraction)));
  const centerY = Math.round(relativeCenterY * page.height);
  const originY = Math.max(0, Math.min(page.height - height, centerY - Math.floor(height / 2)));
  let temporaryUri: string | null = null;
  try {
    const context = ImageManipulator.manipulate(page.uri);
    context.crop({ originX: 0, originY, width: page.width, height });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      base64: false,
      compress: 0.93,
      format: SaveFormat.JPEG,
    });
    temporaryUri = saved.uri;
    const file = new File(saved.uri);
    const byteSize = file.size;
    assertFileSize(byteSize);
    const base64 = await file.base64();
    if (!base64.trim()) {
      throw new Error('Không thể đọc ảnh đã cắt. Hãy chọn vùng tên và thử lại.');
    }
    return {
      id: newPageId(),
      uri: saved.uri,
      mimeType: 'image/jpeg',
      byteSize,
      width: saved.width,
      height: saved.height,
      base64,
      qualityWarnings: [
        'Chỉ quét dải ảnh bạn vừa chọn. Hãy kiểm tra vùng cắt chứa đầy đủ tên thuốc và hàm lượng.',
      ],
    };
  } catch (error) {
    if (temporaryUri) deleteTemporaryPrescriptionUris([temporaryUri]);
    if (error instanceof Error && error.message) throw error;
    throw new Error('Không thể cắt vùng tên thuốc. Hãy thử lại với ảnh khác.');
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

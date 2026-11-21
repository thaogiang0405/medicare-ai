import type { LocalOfflineOcrPageResult } from './local-offline-ocr-bridge';

/**
 * Converts the untrusted percentage reported by Tesseract into the domain's
 * 0..1 confidence and conservative, Vietnamese review warnings.
 */
export function toLocalOfflineOcrPageResult(value: Readonly<{ text: unknown; confidence: unknown }>): LocalOfflineOcrPageResult {
  const text = typeof value.text === 'string' ? value.text.trim() : '';
  const rawConfidence = value.confidence;
  const confidence = typeof rawConfidence === 'number' && Number.isFinite(rawConfidence)
    ? Math.max(0, Math.min(1, rawConfidence / 100))
    : null;
  const qualityWarnings: string[] = [];

  if (!text) {
    qualityWarnings.push('Không nhận được chữ từ ảnh này. Hãy kiểm tra lại ảnh gốc hoặc thêm thuốc thủ công.');
  }
  if (confidence !== null && confidence < 0.65) {
    qualityWarnings.push('Chất lượng nhận dạng thấp. Vui lòng đối chiếu kỹ với đơn gốc.');
  }
  if (confidence === null) {
    qualityWarnings.push('Không có mức độ tin cậy. Vui lòng kiểm tra lại từng trường.');
  }

  return { text, confidence, qualityWarnings };
}

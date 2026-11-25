export const prescriptionOcrUnavailableMessage =
  'Tính năng quét đơn thuốc chưa được bật trong môi trường này. Bạn vẫn có thể thêm thuốc thủ công.';

/**
 * Expo public flags are intentionally not secrets. Local on-device OCR remains
 * opt-in and disabled unless a local build explicitly sets this exact value to
 * `true`. The flag never enables a cloud OCR provider.
 */
export function isPrescriptionOcrFeatureEnabled(
  value = process.env.EXPO_PUBLIC_PRESCRIPTION_OCR_ENABLED,
): boolean {
  return value?.trim().toLowerCase() === 'true';
}

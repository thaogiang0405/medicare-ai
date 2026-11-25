export type PrescriptionOcrErrorCode =
  | 'feature-disabled'
  | 'unauthenticated'
  | 'permission-denied'
  | 'consent-required'
  | 'invalid-argument'
  | 'resource-exhausted'
  | 'unavailable'
  | 'cancelled'
  | 'deadline-exceeded'
  | 'failed-precondition'
  | 'internal';

/** Safe-to-render error; never retain provider payloads, OCR text, or image bytes. */
export class PrescriptionOcrError extends Error {
  constructor(
    readonly code: PrescriptionOcrErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PrescriptionOcrError';
  }
}

export function toPrescriptionOcrError(error: unknown): PrescriptionOcrError {
  if (error instanceof PrescriptionOcrError) {
    return error;
  }

  const code = typeof error === 'object'
    && error !== null
    && 'code' in error
    && typeof error.code === 'string'
    ? error.code.replace(/^functions\//, '')
    : 'internal';

  switch (code) {
    case 'unauthenticated':
      return new PrescriptionOcrError('unauthenticated', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    case 'permission-denied':
      return new PrescriptionOcrError('permission-denied', 'Chỉ tài khoản người cao tuổi đã hoàn tất hồ sơ mới có thể quét đơn thuốc.');
    case 'failed-precondition':
      return new PrescriptionOcrError('failed-precondition', 'Hồ sơ chưa sẵn sàng để quét đơn thuốc. Vui lòng hoàn tất thông tin tài khoản.');
    case 'invalid-argument':
      return new PrescriptionOcrError('invalid-argument', 'Ảnh đơn thuốc không hợp lệ hoặc vượt giới hạn cho phép.');
    case 'resource-exhausted':
      return new PrescriptionOcrError('resource-exhausted', 'Bạn đã quét quá nhiều lần trong thời gian ngắn. Vui lòng thử lại sau.');
    case 'unavailable':
      return new PrescriptionOcrError('unavailable', 'Bộ nhận dạng chữ trên thiết bị chưa sẵn sàng. Vui lòng thử lại hoặc thêm thuốc thủ công.');
    case 'cancelled':
      return new PrescriptionOcrError('cancelled', 'Đã dừng nhận dạng ảnh đơn thuốc.');
    case 'deadline-exceeded':
      return new PrescriptionOcrError('deadline-exceeded', 'Quét đơn thuốc mất quá lâu. Vui lòng thử lại với ảnh rõ hơn.');
    default:
      return new PrescriptionOcrError('internal', 'Không thể quét đơn thuốc lúc này. Bạn có thể thêm thuốc thủ công.');
  }
}

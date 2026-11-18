export class UserProfileRepositoryError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'UserProfileRepositoryError';
  }
}

function getFirebaseErrorCode(error: unknown): string | undefined {
  if (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && typeof error.code === 'string'
  ) {
    return error.code;
  }

  return undefined;
}

/** Maps Firestore failures without logging or exposing profile contents. */
export function mapUserProfileError(error: unknown): UserProfileRepositoryError {
  if (error instanceof UserProfileRepositoryError) {
    return error;
  }

  const code = getFirebaseErrorCode(error);

  if (code === 'permission-denied') {
    return new UserProfileRepositoryError(
      'Không có quyền truy cập hồ sơ. Vui lòng thử lại sau khi Rules được phê duyệt.',
      code,
    );
  }

  if (code === 'unavailable' || code === 'deadline-exceeded') {
    return new UserProfileRepositoryError(
      'Không thể kết nối hồ sơ lúc này. Vui lòng kiểm tra mạng và thử lại.',
      code,
    );
  }

  return new UserProfileRepositoryError('Không thể tải hồ sơ an toàn. Vui lòng thử lại.', code);
}

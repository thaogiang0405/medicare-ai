export type FirebaseAuthOperation =
  | 'signIn'
  | 'register'
  | 'passwordReset'
  | 'signOut'
  | 'passwordPolicy'
  | 'observeAuthState';

/** A safe, localized error for presentation code. It never exposes Firebase's raw message. */
export class AuthRepositoryError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'AuthRepositoryError';
  }
}

export function getFirebaseAuthErrorCode(error: unknown): string | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }

  return undefined;
}

export function isEnumerationSafePasswordResetError(error: unknown): boolean {
  return getFirebaseAuthErrorCode(error) === 'auth/user-not-found';
}

/**
 * Maps Firebase errors to messages suitable for end users. Credential failures
 * deliberately use neutral language so the UI does not confirm account existence.
 */
export function mapFirebaseAuthError(
  error: unknown,
  operation: FirebaseAuthOperation,
): AuthRepositoryError {
  if (error instanceof AuthRepositoryError) {
    return error;
  }

  const code = getFirebaseAuthErrorCode(error);

  if (code === 'auth/invalid-email') {
    return new AuthRepositoryError('Địa chỉ email chưa hợp lệ.', code);
  }

  if (code === 'auth/network-request-failed') {
    return new AuthRepositoryError('Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.', code);
  }

  if (code === 'auth/too-many-requests') {
    return new AuthRepositoryError('Bạn đã thử quá nhiều lần. Vui lòng chờ một lúc rồi thử lại.', code);
  }

  if (operation === 'signIn') {
    return new AuthRepositoryError('Email hoặc mật khẩu không đúng. Vui lòng thử lại.', code);
  }

  if (operation === 'register' || operation === 'passwordPolicy') {
    if (
      code === 'auth/weak-password' ||
      code === 'auth/password-does-not-meet-requirements'
    ) {
      return new AuthRepositoryError(
        'Mật khẩu chưa đáp ứng chính sách bảo mật. Hãy dùng mật khẩu mạnh hơn.',
        code,
      );
    }

    return new AuthRepositoryError(
      'Không thể tạo tài khoản với thông tin đã nhập. Vui lòng kiểm tra và thử lại.',
      code,
    );
  }

  if (operation === 'passwordReset') {
    return new AuthRepositoryError('Không thể gửi yêu cầu đặt lại mật khẩu lúc này. Vui lòng thử lại.', code);
  }

  if (operation === 'signOut') {
    return new AuthRepositoryError('Không thể đăng xuất lúc này. Vui lòng thử lại.', code);
  }

  return new AuthRepositoryError('Không thể khôi phục trạng thái đăng nhập. Vui lòng mở lại ứng dụng.', code);
}

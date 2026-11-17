import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';

import { FirebaseConfigurationError, getFirebaseConfig } from './firebase-config';

/** Raised when Firebase Core cannot be created after configuration validation. */
export class FirebaseInitializationError extends Error {
  constructor(cause: unknown) {
    const details = cause instanceof Error ? cause.message : 'Lỗi không xác định.';
    super(`Không thể khởi tạo Firebase: ${details}`);
    this.name = 'FirebaseInitializationError';
  }
}

/**
 * Returns Firebase's default app, creating it once on a cold start.
 * Fast Refresh can evaluate this module again, so `getApps()` prevents a
 * duplicate default-app initialization.
 */
export function getFirebaseApp(): FirebaseApp {
  try {
    return getApps().length > 0 ? getApp() : initializeApp(getFirebaseConfig());
  } catch (error) {
    if (error instanceof FirebaseConfigurationError || error instanceof FirebaseInitializationError) {
      throw error;
    }

    throw new FirebaseInitializationError(error);
  }
}

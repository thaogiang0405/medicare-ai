import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';

import { getFirebaseApp } from './firebase-app';

let firebaseAuth: Auth | null = null;

function getFirebaseErrorCode(error: unknown): string | undefined {
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

export class FirebaseAuthInitializationError extends Error {
  constructor() {
    super('Không thể khởi tạo Firebase Authentication trên thiết bị này.');
    this.name = 'FirebaseAuthInitializationError';
  }
}

/**
 * Initializes Auth exactly once with React Native AsyncStorage persistence.
 * `getAuth` is only used after Firebase reports an existing Auth instance,
 * which makes Fast Refresh safe without losing the configured persistence.
 */
export function getFirebaseAuth(): Auth {
  if (firebaseAuth) {
    return firebaseAuth;
  }

  const app = getFirebaseApp();

  try {
    firebaseAuth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
    return firebaseAuth;
  } catch (error) {
    if (getFirebaseErrorCode(error) === 'auth/already-initialized') {
      firebaseAuth = getAuth(app);
      return firebaseAuth;
    }

    throw new FirebaseAuthInitializationError();
  }
}

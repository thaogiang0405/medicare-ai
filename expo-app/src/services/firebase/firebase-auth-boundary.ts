import type { FirebaseApp } from 'firebase/app';

import { getFirebaseApp } from './firebase-app';

/**
 * Migration 2.2 composition point for a FirebaseAuthRepository.
 * This deliberately does not import firebase/auth, configure persistence,
 * observe users, or perform any sign-in/register action.
 */
export function getFirebaseAppForAuthentication(): FirebaseApp {
  return getFirebaseApp();
}

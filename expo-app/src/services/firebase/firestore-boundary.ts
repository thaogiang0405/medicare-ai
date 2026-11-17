import type { FirebaseApp } from 'firebase/app';

import { getFirebaseApp } from './firebase-app';

/**
 * Migration 2.2 composition point for Firestore repositories.
 * This deliberately does not import firebase/firestore or read/write data.
 */
export function getFirebaseAppForFirestore(): FirebaseApp {
  return getFirebaseApp();
}

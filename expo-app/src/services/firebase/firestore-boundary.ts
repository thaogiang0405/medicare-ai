import type { FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

import { getFirebaseApp } from './firebase-app';

let firebaseFirestore: Firestore | null = null;

/**
 * Composition point for the limited Migration 2.3 profile repository.
 * It exposes no UI-facing CRUD API and deliberately does not enable Firestore
 * persistence, which is not supported for React Native in the JS SDK.
 */
export function getFirebaseAppForFirestore(): FirebaseApp {
  return getFirebaseApp();
}

/**
 * Returns one modular Firestore instance for the already-configured Firebase
 * App. Firestore persistence is intentionally not enabled in React Native.
 */
export function getFirebaseFirestore(): Firestore {
  firebaseFirestore ??= getFirestore(getFirebaseAppForFirestore());
  return firebaseFirestore;
}

import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';
import type { Persistence } from 'firebase/auth';

/**
 * Firebase 13's React Native runtime exports this function, but the top-level
 * firebase/auth wrapper currently exposes generic declarations to TypeScript.
 * This augmentation mirrors the official React Native declaration without
 * changing runtime module resolution.
 */
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: AsyncStorageStatic): Persistence;
}

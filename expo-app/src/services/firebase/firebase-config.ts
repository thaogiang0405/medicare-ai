import type { FirebaseOptions } from 'firebase/app';

const firebaseRequiredConfigFields = [
  'apiKey',
  'authDomain',
  'projectId',
  'messagingSenderId',
  'appId',
] as const;

type FirebaseRequiredConfigField = (typeof firebaseRequiredConfigFields)[number];

type FirebasePublicEnvironment = Partial<
  Record<FirebaseRequiredConfigField | 'storageBucket' | 'measurementId', string | undefined>
>;

const firebaseEnvironmentVariableNames: Record<
  FirebaseRequiredConfigField | 'storageBucket' | 'measurementId',
  string
> = {
  apiKey: 'EXPO_PUBLIC_FIREBASE_API_KEY',
  authDomain: 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  projectId: 'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  storageBucket: 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'EXPO_PUBLIC_FIREBASE_APP_ID',
  measurementId: 'EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID',
};

/** Raised instead of substituting a fallback Firebase project or mock config. */
export class FirebaseConfigurationError extends Error {
  constructor(readonly missingVariables: readonly string[]) {
    super(
      `Thiếu cấu hình Firebase Web: ${missingVariables.join(', ')}. ` +
        'Hãy tạo expo-app/.env từ .env.example bằng cấu hình chính thức của Firebase Web App.',
    );
    this.name = 'FirebaseConfigurationError';
  }
}

function normalizeEnvironmentValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

/**
 * Builds a Firebase client config only from supplied public Web App identifiers.
 * `storageBucket` is optional because this app currently uses Auth + Firestore,
 * not Firebase Storage. `measurementId` is optional because Analytics is not used.
 */
export function createFirebaseConfig(environment: FirebasePublicEnvironment): FirebaseOptions {
  const config = {
    apiKey: normalizeEnvironmentValue(environment.apiKey),
    authDomain: normalizeEnvironmentValue(environment.authDomain),
    projectId: normalizeEnvironmentValue(environment.projectId),
    storageBucket: normalizeEnvironmentValue(environment.storageBucket),
    messagingSenderId: normalizeEnvironmentValue(environment.messagingSenderId),
    appId: normalizeEnvironmentValue(environment.appId),
    measurementId: normalizeEnvironmentValue(environment.measurementId),
  };

  const missingVariables = firebaseRequiredConfigFields
    .filter((field) => !config[field])
    .map((field) => firebaseEnvironmentVariableNames[field]);

  if (missingVariables.length > 0) {
    throw new FirebaseConfigurationError(missingVariables);
  }

  return {
    apiKey: config.apiKey!,
    authDomain: config.authDomain!,
    projectId: config.projectId!,
    ...(config.storageBucket ? { storageBucket: config.storageBucket } : {}),
    messagingSenderId: config.messagingSenderId!,
    appId: config.appId!,
    ...(config.measurementId ? { measurementId: config.measurementId } : {}),
  };
}

/**
 * Expo only inlines EXPO_PUBLIC_* variables when they are referenced with dot
 * notation. Do not destructure process.env or use bracket notation here.
 */
export function getFirebaseConfig(): FirebaseOptions {
  return createFirebaseConfig({
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
  });
}

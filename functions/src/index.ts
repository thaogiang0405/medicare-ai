import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { defineBoolean } from 'firebase-functions/params';

import { OCR_REGION } from './ocr/contracts';
import { AdminUserProfileReader } from './ocr/profile';
import { FirestoreOcrRateLimiter } from './ocr/rate-limiter';
import { processPrescriptionOcrRequest } from './ocr/service';
import { GoogleCloudVisionOcrProvider } from './ocr/vision-provider';

/**
 * Keep App Check non-enforcing until a real iOS/Android App Check provider has
 * been registered and verified outside Expo Go. When enabled at deployment,
 * callable requests without valid App Check tokens are rejected by Functions.
 */
const enforceOcrAppCheck = defineBoolean('OCR_ENFORCE_APP_CHECK', {
  default: false,
  description: 'Require valid Firebase App Check tokens for prescription OCR.',
});

const adminApp = getApps().length > 0 ? getApp() : initializeApp();
const firestore = getFirestore(adminApp);

const dependencies = {
  profiles: new AdminUserProfileReader(firestore),
  rateLimiter: new FirestoreOcrRateLimiter(firestore),
  provider: new GoogleCloudVisionOcrProvider(),
};

/**
 * Authenticated-only callable OCR endpoint. It receives short-lived image bytes
 * in memory and returns text only; it does not write source images, OCR text,
 * or prescription records to Firestore or Storage.
 */
export const recognizePrescription = onCall(
  {
    region: OCR_REGION,
    timeoutSeconds: 60,
    memory: '512MiB',
    concurrency: 5,
    maxInstances: 10,
    // Pass the declared parameter through to the v2 callable runtime option.
    // It remains false by default until native App Check has been verified,
    // while Firebase resolves the selected value safely at deployment/runtime.
    enforceAppCheck: enforceOcrAppCheck,
  },
  async (request) =>
    processPrescriptionOcrRequest(
      {
        auth: request.auth ? { uid: request.auth.uid } : null,
        data: request.data,
      },
      dependencies,
    ),
);

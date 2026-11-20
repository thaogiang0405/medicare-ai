# AI Phase 1 — Prescription OCR

AI Phase 1 adds a review-first prescription OCR flow for an authenticated,
onboarded `elderly` user. It is intentionally **not** a prescription store,
diagnosis feature, dosage adviser, automatic schedule creator, or caregiver
data-sharing feature.

## Current delivery status

- Expo client code, the callable Function v2 source, unit tests, and feature
  flag are present in this repository.
- `EXPO_PUBLIC_PRESCRIPTION_OCR_ENABLED=false` remains the safe default in
  `.env.example`.
- The real Cloud Function and Vision API are **not deployed by this milestone**.
  Until a separately approved deployment succeeds, local feature enablement
  will show an honest unavailable state and offers manual medication entry.
- The test-only synthetic provider is only injectable in automated tests. It is
  labeled as demo and is never selected by the production client composition.

## User flow and privacy boundary

1. The elderly-only route `/elderly/prescription-ocr` is protected by the
   existing role route guard.
2. The user scans a document or chooses up to three images. The app presents a
   preview and supports reorder, replacement, removal, and a full rescan.
3. Each page is re-encoded as a bounded JPEG in the app cache, correcting
   orientation and avoiding exposed picker EXIF metadata. It is never copied to
   Photos, Firebase Storage, AsyncStorage, analytics, or application logs.
4. Before any cloud call, the user must explicitly consent to processing the
   image by Google Cloud.
5. The callable returns text only. A conservative Vietnamese parser creates
   separate, editable candidates and preserves source lines only in memory for
   this review session.
6. The user chooses/edit candidates and explicitly confirms saving. The
   existing M3.2 `MedicationRepository` creates independent medication records;
   no existing record is changed and no schedule is automatically created.
7. Cancel, logout, account switch, route exit, and successful completion clear
   the in-memory draft. App-created cache images are removed on a best-effort
   basis. The user can still need to close the system picker/scanner itself.

The UI warns that OCR can be wrong and asks the user to verify the original
prescription and consult a health professional when unsure. It never infers a
drug name, strength, frequency, diagnosis, substitution, or dose that does not
appear clearly in the OCR result.

## Callable backend

`functions/src/index.ts` exports the authenticated callable v2
`recognizePrescription` in `asia-east1`.

- It requires Firebase Auth and reads the canonical `users/{uid}` profile using
  the Admin SDK. The profile must be complete and exclusively `elderly`; no
  UID/role supplied by the UI grants access.
- The request requires consent, accepts at most three JPEG/PNG/WebP pages,
  verifies MIME signatures and decoded byte counts, limits a page to 5 MiB and
  a request to 10 MiB, and processes Vision calls sequentially.
- A server-only Firestore transaction rate-limits each UID. It stores only a
  counter/timing record in `_serverOcrRateLimits`, never image bytes or OCR
  text. Existing default-deny Rules keep this collection inaccessible to the
  mobile client.
- The provider calls Google Cloud Vision `DOCUMENT_TEXT_DETECTION` with a
  Vietnamese language hint using Application Default Credentials/the deployed
  Function service identity. It does not use an Expo variable, service account
  JSON, public HTTP endpoint, Firebase Storage, or client-provided credential.
- Raw image data, OCR text, and provider error details are not logged or
  persisted. Returned text has an additional bounded response limit.

## Requirements before live OCR testing

Do **not** enable the flag for real users until the project owner has separately
reviewed and approved all of the following for Firebase project
`medicare-ai-cf804`:

1. Use Node.js 22 for the Functions deployment environment; install packages
   under `functions/` and run `npm run build` and `npm test`.
2. Enable billing required by Cloud Functions v2 and Google Cloud Vision, then
   enable the Vision API for the existing project.
3. Grant the deployed Functions service identity only the least-privilege
   access required to call Vision; validate this with a synthetic image before
   processing any real prescription.
4. Review rate-limit retention and, if needed, configure server-side Firestore
   TTL operationally for `_serverOcrRateLimits`. No health data belongs there.
5. Review Vision quota and budget-alert response before broader release. The
   current server-side limit is five valid requests per UID every ten minutes;
   it is not a global cost cap. No test UID allowlist is hard-coded, so do not
   expose a broader cohort while App Check is disabled without a separately
   reviewed server-enforced access control.
6. Validate Firebase App Check from approved native iOS/Android builds. Expo Go
   is not proof of production App Check assurance. Only then set the Functions
   parameter `OCR_ENFORCE_APP_CHECK=true`; it defaults to `false` so a pending
   native App Check rollout does not silently lock out the current app.
7. Obtain a dedicated deployment approval, then use the exact scoped command:

   ```powershell
   firebase deploy --only functions:ocr --project medicare-ai-cf804
   ```

This milestone does not run that command and does not deploy Firestore Rules,
Storage, indexes, or any client flag change.

## Local flag and iPhone QA

The `.env` file is local and ignored. After the callable is deployed and a test
environment is approved, set only this non-secret value locally:

```dotenv
EXPO_PUBLIC_PRESCRIPTION_OCR_ENABLED=true
```

Then run `npx expo start --clear --lan` in `expo-app/` and open it with an Expo
Go SDK 58-compatible iPhone. Test only synthetic/non-sensitive prescriptions:

- denied/allowed camera and Photos permissions; picker/scanner cancellation;
- one, multiple, replacement, reorder, remove, rescan, oversized and low
  quality image handling;
- consent required before the cloud request, offline/backend retry, and a
  disabled-flag manual-entry fallback;
- multiple OCR candidates, ambiguity warnings, edit/select/remove/add manual
  candidate, duplicate candidate prevention, partial save retry;
- logout/account switch while a request is pending; no content from account A
  appears for account B;
- saved medications appear only in the signed-in elderly owner’s M3.2 list;
  no schedule is created automatically.

Do not use real prescriptions or health records for tests. Do not treat an OCR
result as medical advice or confirmation that a medication was taken.

# Prescription OCR Cloud Function

`recognizePrescription` is an authenticated Firebase callable Function v2 in
`asia-east1`. It is source-only in this repository: this milestone does **not**
deploy a Function, enable Cloud Vision, or change any production Firebase
resource.

## Security boundary

- The callable rejects unauthenticated requests.
- It reads `users/{uid}` with the Admin SDK and only accepts an onboarded,
  canonical `elderly` profile. A UI role or UID in the payload is never trusted.
- The request requires explicit `consentAccepted: true`, accepts at most three
  JPEG, PNG, or WebP pages, validates decoded bytes, and enforces a 5 MiB
  per-page / 10 MiB total ceiling.
- Cloud Vision calls are sequential and bounded. Source image bytes and OCR text
  remain in process memory only; neither is written to Firestore, Storage,
  analytics, debug logs, or error responses.
- The callable caps returned OCR text to 12,000 characters per page and 30,000
  characters per request, marking any truncation for user review rather than
  silently treating it as complete text.
- `_serverOcrRateLimits/{uid}` contains only server-side counter/expiry metadata
  for a cross-instance rate limit. It is protected by the existing default-deny
  Rules surface and contains no prescription data.
- The production provider uses Application Default Credentials from the Cloud
  Functions service identity. Never add Vision credentials, service-account
  JSON, or secrets to Expo variables or this repository.

## Local checks

```powershell
Set-Location functions
npm install
npm run build
npm test
```

The `SyntheticPrescriptionOcrProvider` exists only for unit tests. Its output
is visibly marked synthetic and production wiring never falls back to it.

## Requirements before a separately approved deployment

1. Use the existing Firebase project `medicare-ai-cf804`; do not create a new
   project.
2. Enable billing and the Google Cloud Vision API for that project.
3. Confirm the deployed Cloud Functions runtime service identity can use the
   enabled Vision API with least-privilege IAM. Test this with a non-production,
   synthetic image before real-world use.
4. Install dependencies in `functions/`, build successfully, and deploy only
   after explicit approval, for example:

   ```powershell
   firebase deploy --only functions:ocr --project medicare-ai-cf804
   ```

   The local Firebase configuration runs `npm run build` as the Functions
   predeploy hook; generated `lib/` output is intentionally uploaded but never
   committed.

5. Verify App Check on a real native build before setting the deploy parameter
   `OCR_ENFORCE_APP_CHECK=true`. It deliberately defaults to `false` because
   Expo Go does not provide a production-ready App Check assurance for this
   workflow. Do not enforce until valid tokens are observed from the approved
   iOS and Android builds.

Cloud Vision availability, billing, API enablement, runtime IAM, and App Check
are deployment prerequisites. Until those conditions are met and the function
is explicitly deployed, real OCR is deployment-blocked; the mobile app must
offer its manual medication-entry fallback instead.

# Archived prescription OCR Cloud Function source

This directory retains the historical `recognizePrescription` Firebase
Callable/Google Cloud Vision implementation for migration traceability only.
It is **not** part of the MediCare AI mobile OCR runtime.

Current OCR uses the on-device Tesseract.js DOM/WebView bridge described in
[`../docs/prescription-ocr-ai-phase-1.md`](../docs/prescription-ocr-ai-phase-1.md).
The app does not select the Callable gateway, and no Firebase Function, Cloud
Vision API, Firebase Storage upload, billing/Blaze change, or server OCR is
needed for local OCR.

Do not deploy this codebase for the free-OCR release:

```bash
# Intentionally do not run this for the local OCR release.
firebase deploy --only functions:ocr --project medicare-ai-cf804
```

Keep any future decision to revive a server OCR path in a separately reviewed
milestone, with explicit cost, privacy, IAM, App Check and data-retention
approval. Never put service-account credentials, Vision keys, images, raw OCR
text or health records in this directory, client source, logs or analytics.

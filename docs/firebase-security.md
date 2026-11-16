# Firebase security strategy

## Nguyên tắc

1. Authentication state, route redirect và role selector trong UI chỉ là trải nghiệm. Firestore/Storage Rules là lớp enforcement client-facing.
2. Hồ sơ người cao tuổi là boundary sở hữu. Owner UID có toàn quyền cần thiết; caregiver chỉ dùng scope của một `caregiverLink` có `status == active`.
3. Invite approval/revoke, dashboard projection, audit log, future dose-event generation and caregiver FCM happen in Cloud Functions/Admin SDK, not arbitrary clients.
4. Defaults are least privilege: caregiver does not see raw OCR/prescription image and cannot report a dose on behalf of elderly by default.
5. Rules must be tested in Firebase Emulator with authenticated personas and query tests, not only single-document gets.

## Baseline files

- [`firestore.rules`](../firestore.rules) — conservative client permissions and owner/scope checks.
- [`storage.rules`](../storage.rules) — same ownership boundary for prescription/medication images.
- [`firestore.indexes.json`](../firestore.indexes.json) — known compound query indexes.

These are a baseline, not an authorization certification. Before deployment, add schema/type/field validation for every final DTO and run emulator tests per use case.

## Required authorization tests

| Scenario | Expected result |
|---|---|
| Unauthenticated user reads any profile | Denied |
| Elderly owner creates own profile, medication and response | Allowed only for own `elderlyId` |
| Caregiver with no link / pending / revoked link queries health data | Denied |
| Active caregiver reads medication with `medicationsRead` | Allowed |
| Active caregiver reads OCR with `ocrRead: false` | Denied |
| Caregiver sets own link to active | Denied |
| Caregiver marks `reportedTaken` without special assisted-flow scope | Denied |
| Client writes audit log, notification or caregiver index | Denied |
| User tries to change immutable `uid`, owner or role fields | Denied |
| Storage download after revoke | Denied for future request |

## Production hardening checklist

- Enable App Check for Android and enforce it after staged rollout.
- Require Firebase Auth email/phone verification policy appropriate to the thesis demo and privacy policy.
- Store invite code hash only; give code expiry, single-use semantics and brute-force rate limit via Callable Function.
- Filter or turn off crash/analytics collection for prescription text, image paths and health metadata.
- Use Cloud Functions service account with minimum IAM roles; never ship Admin credentials to Flutter.
- Use Firestore TTL or scheduled cleanup for expired OCR docs/images and inactive device tokens.
- Put a generic notification payload on lock screen; medication names are sensitive.
- Document retention, consent, access/revoke behavior and incident process before using real patient data.

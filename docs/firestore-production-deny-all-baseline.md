# Firestore production deny-all rollback baseline

## Recorded scope

- **Project:** `medicare-ai-cf804`
- **Database:** `(default)`
- **Location:** `asia-east1`
- **Recorded on:** 2026-11-18
- **Source:** Firebase Console source verified directly by the project owner.

This document is a local rollback baseline only. It does not replace the
Migration 2.3 source in [`../firestore.rules`](../firestore.rules), does not
deploy anything, and must not be treated as an application feature flag.

## Production rules before a Migration 2.3 deployment

```rules
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Controlled rollback procedure

1. Confirm in the Firebase Console Rules timeline that this is the intended
   prior ruleset for the `(default)` database.
2. Obtain explicit project-owner approval before changing any production rule.
3. Restore it through the Console Rules timeline, or deploy an independently
   reviewed temporary copy using a command that explicitly selects
   `--project medicare-ai-cf804` and `--only firestore:rules`.
4. Verify that only Firestore Rules changed; do not include Storage Rules,
   indexes, feature flags, or application code in the rollback.

The workspace has no `.firebaserc` active-project alias. A future deployment
must therefore always name the Firebase project explicitly; do not rely on an
implicit Firebase CLI project selection.

## Migration 2.3 deployment record

- **Deployment verification recorded at:** 2026-11-18 08:52:59 +07:00
- **Destination:** `medicare-ai-cf804` / `(default)` / `asia-east1`
- **Command:** `firebase deploy --only firestore:rules --project medicare-ai-cf804`
- **CLI result:** `released rules firestore.rules to cloud.firestore`
- **Deployed source SHA-256:**
  `0BE44F3A28E63F5375381A06946FFB24F3111E73163E2C301E2B5003FD165B66`

Only Firestore Rules were selected. Storage Rules, indexes, Hosting, Cloud
Functions, application code, and the Firestore profiles feature flag were not
deployed or changed by this release.

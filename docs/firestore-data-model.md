# Mô hình Firestore và đồng bộ

## Ranh giới dữ liệu

Toàn bộ dữ liệu sức khỏe thuộc một người cao tuổi nằm dưới `elderlyProfiles/{elderlyId}`. `elderlyId` chính là Firebase Auth UID của chủ hồ sơ. Ranh giới này giúp Security Rules kiểm tra owner/link nhất quán và tránh query chéo vô tình rò rỉ dữ liệu.

```text
/users/{uid}
  /devices/{deviceId}
  /notifications/{notificationId}
  /elderlyIndex/{elderlyId}              # projection server-only cho caregiver dashboard

/caregiverProfiles/{caregiverUid}

/elderlyProfiles/{elderlyId}
  /caregiverLinks/{caregiverUid}
  /prescriptions/{prescriptionId}
  /medications/{medicationId}
  /medicationSchedules/{scheduleId}
  /doseEvents/{doseEventId}
  /ocrResults/{ocrResultId}
  /auditLogs/{auditLogId}

/caregiverInvites/{inviteId}             # Callable Function/Admin SDK only
```

`elderlyIndex` is an optional denormalized projection. It is never the source of authorization; `caregiverLinks` is.

## Documents

### Users and profile

```json
// users/{uid}
{
  "uid": "firebase-auth-uid",
  "primaryRole": "elderly",
  "roles": { "elderly": true, "caregiver": false },
  "displayName": "Nguyễn Văn A",
  "locale": "vi",
  "timeZone": "Asia/Ho_Chi_Minh",
  "onboardingCompleted": true,
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}

// elderlyProfiles/{elderlyUid}
{
  "ownerUid": "elderlyUid",
  "sharedProfile": { "displayName": "Nguyễn Văn A", "birthYear": 1945 },
  "preferences": { "fontScale": "large", "ttsEnabled": true, "timeZone": "Asia/Ho_Chi_Minh" },
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

Không lưu mật khẩu, token, raw OCR hay thuốc trong `/users`.

### Caregiver link

```json
// elderlyProfiles/{elderlyId}/caregiverLinks/{caregiverId}
{
  "elderlyId": "elderlyUid",
  "caregiverId": "caregiverUid",
  "status": "pending",
  "initiatedBy": "caregiverUid",
  "invitationId": "invite-id",
  "scopes": {
    "profileRead": true,
    "medicationsRead": true,
    "medicationsWrite": false,
    "schedulesRead": true,
    "schedulesWrite": false,
    "doseHistoryRead": true,
    "ocrRead": false
  },
  "createdAt": "Timestamp",
  "acceptedAt": null,
  "revokedAt": null,
  "updatedAt": "Timestamp",
  "version": 1
}
```

Status lifecycle: `pending → active | rejected | expired`; `active → revoked`. Caregiver can never set `active` from client. A Callable Function hashes invite codes, validates expiry and creates pending link; elderly approval and revocation run through server-trusted code/transaction.

### Prescription and OCR

```json
// prescriptions/{prescriptionId}
{
  "elderlyId": "elderlyUid",
  "source": "ocr",
  "status": "draft",
  "imagePath": "prescriptions/{elderlyId}/{id}/source.jpg",
  "ocrResultId": "ocr-id",
  "reviewedBy": null,
  "reviewedAt": null,
  "createdBy": "uid",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}

// ocrResults/{ocrResultId}
{
  "elderlyId": "elderlyUid",
  "imagePath": "ocr/{elderlyId}/{ocrId}/source.jpg",
  "rawText": "sensitive OCR text",
  "candidates": [],
  "fieldConfidence": {},
  "status": "reviewRequired",
  "reviewedBy": null,
  "reviewedAt": null,
  "expiresAt": "Timestamp",
  "createdAt": "Timestamp"
}
```

Allowed OCR statuses: `processing`, `reviewRequired`, `confirmed`, `rejected`, `expired`. `rawText` and images have retention/cleanup policy and never go to client logs. A schedule creation use case must reject an OCR-derived request whose prescription/result is not confirmed.

### Medication M3.2 and future schedule

```json
// elderlyProfiles/{elderlyId}/medications/{medicationId}
{
  "ownerUid": "elderlyUid",
  "name": "Tên thuốc do chủ hồ sơ ghi nhận",
  "strengthText": "500 mg",
  "directionsText": "Nguyên văn do chủ hồ sơ cung cấp",
  "status": "active",
  "revision": 1,
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}

// medicationSchedules/{scheduleId}
{
  "elderlyId": "elderlyUid",
  "medicationId": "medication-id",
  "medicationRevision": 1,
  "active": true,
  "timeZone": "Asia/Ho_Chi_Minh",
  "recurrence": {
    "type": "daily",
    "localTime": "08:00",
    "weekdays": [1, 2, 3, 4, 5, 6, 7]
  },
  "startDate": "2026-11-16",
  "endDate": null,
  "nextOccurrenceAt": "Timestamp",
  "revision": 1,
  "createdBy": "uid",
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

M3.2 chỉ cho phép exact schema Medication ở trên. `ownerUid` và `createdAt`
không thay đổi; `revision` tăng đúng một lần cho mỗi update; `status` chỉ đi từ
`active` sang `inactive` (không hard delete hoặc re-activate). `prescriptionId`,
image, form, ngày bắt đầu/kết thúc, schedule và bất kỳ dữ liệu lâm sàng nào chưa
thuộc schema M3.2 và vẫn bị Rules từ chối. Client không tạo lịch hay tự suy luận
liều dùng từ các trường text này.

One schedule is one local administration time. This makes recurrence, notification IDs and edit semantics simpler. Preserve user-entered strings such as strength/directions; do not normalize into a dosage decision.

### Dose events and notifications

```json
// doseEvents/{scheduleId}_{utcMillis}
{
  "elderlyId": "elderlyUid",
  "scheduleId": "schedule-id",
  "scheduleRevision": 1,
  "occurrenceKey": "2026-11-16T08:00@Asia/Ho_Chi_Minh",
  "scheduledAt": "Timestamp",
  "scheduledLocalDate": "2026-11-16",
  "scheduledLocalTime": "08:00",
  "timeZone": "Asia/Ho_Chi_Minh",
  "medicationSnapshot": { "name": "...", "strengthText": "...", "directionsText": "..." },
  "status": "pending",
  "respondedBy": null,
  "respondedAt": null,
  "responseSource": null,
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

Status: `pending`, `snoozed`, `reportedTaken`, `reportedSkipped`, `unanswered`, `cancelled`. A dose event contains immutable medication/schedule snapshots so historical views remain truthful after an edit.

Server-generated notification docs use deterministic IDs, e.g. `{doseEventId}_initialReminder`, and include `idempotencyKey`, `scheduledFor`, `deliveryState`, `sentAt`. Lock-screen payload must be generic and not reveal medication names by default.

## Timestamp, update and idempotency rules

1. Persist instant fields as Firestore `Timestamp`/UTC. Business date is ISO `YYYY-MM-DD`, local time is `HH:mm`, and each schedule carries IANA timezone.
2. Each client mutation has `operationId`; critical updates use Firestore transaction and optimistic `revision`.
3. Dose event ID and notification ID are deterministic. FCM/local delivery is at-least-once, so client/backend dedupe by event/key.
4. Changing a schedule increments its revision or ends the old one at a future effective time. Never rewrite dose events already generated.
5. Stopping a medication/schedule prevents future event creation; it does not delete history.
6. Revoke marks the link inactive, stops future caregiver notifications and deletes projection records. It cannot erase data already observed by the caregiver.

## Queries/indexes

Prepare collection-group indexes for dose events (`status + scheduledAt`), active medications (`status + updatedAt`), schedules (`active + nextOccurrenceAt`) and notification delivery (`deliveryState + scheduledFor`). M3.2 lists a single owner's collection by `updatedAt`, so it does not deploy an index. See `firestore.indexes.json` for future work.

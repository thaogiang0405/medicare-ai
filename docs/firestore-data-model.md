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

### Medication M3.2 and schedules M3.3

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

// elderlyProfiles/{elderlyId}/medicationSchedules/{scheduleId}
{
  "ownerUid": "elderlyUid",
  "medicationId": "medication-id",
  "recurrence": "daily",
  "localTime": "08:00",
  "weekdays": [1, 2, 3, 4, 5, 6, 7],
  "startDate": "2026-11-16",
  "endDate": null,
  "timeZone": "Asia/Ho_Chi_Minh",
  "active": true,
  "revision": 1,
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

M3.2 chỉ cho phép exact schema Medication ở trên. `ownerUid` và `createdAt`
không thay đổi; `revision` tăng đúng một lần cho mỗi update; `status` chỉ đi từ
`active` sang `inactive` (không hard delete hoặc re-activate).

M3.3 dùng one schedule = one local administration time. `localTime` là `HH:mm`
theo `Asia/Ho_Chi_Minh`, `startDate`/`endDate` là ISO date-only local (không
phải UTC instant), và `weekdays` dùng `1` (Thứ Hai) đến `7` (Chủ Nhật). Lịch
`daily` luôn chứa đủ bảy thứ; lịch `weekly` chứa một hay nhiều thứ không lặp.
`ownerUid`, `medicationId`, `createdAt` không thay đổi; schedule chỉ có thể
chuyển từ `active` sang `inactive`, không hard delete hoặc re-activate qua
client. Tạo lịch yêu cầu medication cùng owner đang `active`.

`nextOccurrenceAt`, `medicationRevision`, `createdBy`, notification metadata,
và bất kỳ metadata tin cậy nào để kích hoạt nhắc uống đều không thuộc client
schema M3.3. Chúng chỉ có thể được tính/lưu qua một cơ chế server-trusted đã
được review ở milestone sau. M3.3 không tạo DoseEvent, thông báo hoặc suy luận
liều dùng từ tên/hướng dẫn thuốc.

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
4. Changing a schedule increments its revision. M3.3 has no generated dose events, and a future trusted scheduler must never rewrite dose events already generated.
5. Stopping a medication/schedule prevents future event creation in a later milestone; it does not delete history.
6. Revoke marks the link inactive, stops future caregiver notifications and deletes projection records. It cannot erase data already observed by the caregiver.

## Queries/indexes

Prepare collection-group indexes for dose events (`status + scheduledAt`), active medications (`status + updatedAt`), future trusted schedule occurrence metadata, and notification delivery (`deliveryState + scheduledFor`). M3.2/M3.3 list a single owner's collection by `updatedAt`, so no index is deployed in this milestone. See `firestore.indexes.json` for future work.

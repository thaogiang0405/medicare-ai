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
  /prescriptions/{prescriptionId}        # reserved; not used by AI Phase 1
  /medications/{medicationId}
  /medicationSchedules/{scheduleId}
  /doseEvents/{doseEventId}
  /ocrResults/{ocrResultId}              # reserved; not used by AI Phase 1
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

### Family Care invite and caregiver link

```json
// familyInvites/{inviteCode}
{
  "ownerUid": "elderlyUid",
  "ownerDisplayName": "Tên hiển thị chủ hồ sơ",
  "inviteCode": "20-character-firestore-auto-id",
  "status": "open",
  "expiresAt": "Timestamp (about 24 hours after creation)",
  "claimedByUid": null,
  "claimedAt": null,
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}

// elderlyProfiles/{elderlyId}/caregiverLinks/{caregiverUid}
{
  "ownerUid": "elderlyUid",
  "ownerDisplayName": "Tên hiển thị chủ hồ sơ",
  "caregiverUid": "caregiverUid",
  "caregiverDisplayName": "Tên hiển thị người chăm sóc",
  "inviteCode": "same invite ID",
  "status": "pending",
  "scopes": { "medicationsRead": true, "schedulesRead": true },
  "revision": 1,
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

Invite lifecycle: `open → claimed → consumed` (approved) or `open → claimed → rejected`. Expired open invites cannot be read/claimed. Each invite is claimed once; retry by the same caregiver is idempotent only while its matching link remains pending. Claim and pending-link creation are separate transactions to avoid circular Rules evaluation: after claim, only the same caregiver can retry link creation; other accounts cannot take the invite. Owner approval/rejection uses two retry-safe transactions: first the invite records the owner's decision, then the link changes state. Rules require the matching consumed/rejected invite state before the pending link can become active/rejected. Only `active` links authorize medication/schedule reads. Caregiver discovery uses a collection-group query constrained to the signed-in caregiver UID and returns link metadata only.

The invitation ID is a locator, not a permission token. Knowing it can create a pending request but cannot grant health-data access. Owner confirmation remains mandatory. Revoked/rejected links are not reactivated or deleted in this MVP.

### Prescription and OCR — AI Phase 1

AI Phase 1 deliberately creates **no** client-writable `prescriptions`,
`ocrResults`, `auditLogs`, or Firebase Storage records. The reviewed local
source for those collections is not an active schema or permission surface.

The app keeps source images, raw OCR text, candidates, and confidence warnings
only in an in-memory review session. After explicit consent, an authenticated
callable Function processes bounded image bytes in memory and returns text to
the same active session; it does not persist source bytes or text. The only
server-side operational record is a default-deny rate-limit counter in
`_serverOcrRateLimits/{uid}`, containing no prescription data.

When the user explicitly confirms an edited candidate, the existing M3.2
MedicationRepository independently creates an ordinary medication document.
No prescription metadata, image path, raw OCR text, dosage recommendation, or
automatic schedule is added to that medication document.

Any future retained prescription/OCR schema requires a separate privacy,
retention, Rules, Storage, and migration review. It must not be inferred from
AI Phase 1 or opened through client Rules without that approval.

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
schedule schema. Chúng chỉ có thể được tính/lưu qua một cơ chế server-trusted
đã được review ở milestone sau. Ứng dụng không suy luận liều dùng từ tên hoặc
hướng dẫn thuốc.

One schedule is one local administration time. This makes recurrence, notification IDs and edit semantics simpler. Preserve user-entered strings such as strength/directions; do not normalize into a dosage decision.

### Dose events M3.4 and local notifications

```json
// elderlyProfiles/{elderlyId}/doseEvents/{scheduleId}__{localDate}__{localTime}
{
  "ownerUid": "elderlyUid",
  "scheduleId": "schedule-id",
  "medicationId": "medication-id",
  "occurrenceKey": "2026-11-16T08:00@Asia/Ho_Chi_Minh",
  "scheduledAt": "Timestamp",
  "scheduledLocalDate": "2026-11-16",
  "scheduledLocalTime": "08:00",
  "timeZone": "Asia/Ho_Chi_Minh",
  "medicationSnapshot": { "name": "...", "strengthText": "...", "directionsText": "..." },
  "status": "reportedTaken",
  "responseSource": "selfReported",
  "respondedBy": "elderlyUid",
  "respondedAt": "Timestamp",
  "responseHistory": {
    "initial": {
      "status": "reportedTaken",
      "responseSource": "selfReported",
      "respondedBy": "elderlyUid",
      "respondedAt": "Timestamp"
    }
  },
  "revision": 1,
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

M3.4 tạo document chỉ khi chủ hồ sơ chủ động chọn `reportedTaken` hoặc
`reportedSkipped` cho một lần uống đã đến giờ; khi chưa có document, UI hiển thị
“Chưa ghi nhận”, không suy diễn bỏ liều. ID được quyết định bởi schedule + ngày
và giờ địa phương. Transaction trả lại kết quả cùng status khi bấm lặp, nhưng
từ chối status khác. Client không update/delete document sau đó; `responseHistory`
và medication snapshot vì vậy bất biến, kể cả sau khi thuốc/lịch được sửa hoặc
tạm dừng. Đây là phản hồi tự báo, không phải xác nhận y tế.

Màn hình lịch sử chỉ query collection con của chính owner với cửa sổ lịch HCM
giới hạn (hôm nay, 7 ngày hoặc 30 ngày), `pageSize` tối đa 30 và cursor gồm
`scheduledLocalDate`, `scheduledLocalTime`, document ID. Không có truy vấn
collection-group từ client và không tải toàn bộ `doseEvents`. Lịch sử chỉ hiển
thị DoseEvent bất biến đã tồn tại; với các ngày trước, app không dựng lại hay
suy đoán lần uống bị thiếu sau khi schedule đã đổi hoặc tạm dừng.

Local reminders M3.4 không tạo Firestore `/notifications` document. Sau thao tác
đồng ý rõ ràng của người dùng, thiết bị chỉ lưu mapping opaque giữa notification
ID do hệ điều hành cấp và occurrence key trong AsyncStorage; mapping không chứa
tên thuốc. Nội dung màn hình khóa luôn chung chung. Không có FCM, Cloud
Functions, background server scheduler hoặc đảm bảo thời điểm chính xác khi
offline/chưa đồng bộ.

Trên một thiết bị, app chỉ lập rolling horizon tối đa 14 ngày và tối đa 48
notification ID do MediCare AI quản lý. Khi thiết bị đã có reminder không thuộc
mapping của account hiện tại, app dành trước capacity thay vì hủy chúng. Tắt
reminder chỉ hủy ID được lưu cho đúng UID và thu hồi consent local của UID đó;
đăng xuất chỉ hủy ID pending của UID, không dùng `cancelAll`. Horizon được refill
khi app quay foreground, sang ngày HCM, đồng bộ tay hoặc dữ liệu thuốc/lịch đổi;
không thể bảo đảm refill nếu app không được mở trong thời gian dài.

Rules xác minh owner elderly, schema, server timestamps, ID/key, schedule/medication
cùng owner đang active, snapshot thuốc và `scheduledAt <= request.time`. Với múi
giờ cố định Asia/Ho_Chi_Minh, Rules cũng so sánh exact UTC instant với local date
và `HH:mm`, rồi kiểm tra recurrence daily/weekly và weekday của schedule. Điều này
ngăn client đổi local date, local time hoặc thứ lặp để tạo occurrence khác từ một
schedule đã lưu; nhưng không tạo nguồn occurrence độc lập client hoặc chứng minh
hành vi uống thuốc ngoài đời. DoseEvent vẫn là self-report, không phải xác nhận y
tế; một scheduler server-trusted là điều kiện cần nếu milestone sau cần bảo đảm
recurrence/clock tuyệt đối ngoài dữ liệu client khai báo.

## Timestamp, update and idempotency rules

1. Persist instant fields as Firestore `Timestamp`/UTC. Business date is ISO `YYYY-MM-DD`, local time is `HH:mm`, and each schedule carries IANA timezone.
2. Critical dose-response creates use a Firestore transaction and immutable `revision: 1`; a confirmed response is never overwritten.
3. Dose event ID and local reminder logical key are deterministic. Local delivery is best effort, so the device dedupes only MediCare-owned IDs.
4. Changing a schedule increments its own revision. A future trusted scheduler must never rewrite self-reported dose events already generated.
5. Stopping a medication/schedule prevents future event creation in a later milestone; it does not delete history.
6. Family Care MVP revocation marks the link inactive; Firestore Rules deny subsequent reads and the caregiver client clears its visible state and listeners. The MVP creates no projection documents or caregiver notifications to delete. Revocation cannot erase data already observed, copied, or screenshotted by the caregiver.

## Queries/indexes

`doseEvents` history dùng index `scheduledLocalDate DESC + scheduledLocalTime DESC + __name__ DESC`; source đã được thêm vào `firestore.indexes.json` nhưng **chưa được deploy**. Việc deploy index cần phê duyệt riêng cùng với Rules M3.4, vì production phải được đối chiếu trước. Các index dự kiến khác gồm `status + scheduledAt`, active medications (`status + updatedAt`), future trusted schedule occurrence metadata và notification delivery (`deliveryState + scheduledFor`).

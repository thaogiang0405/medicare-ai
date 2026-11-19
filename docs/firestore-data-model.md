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
6. Revoke marks the link inactive, stops future caregiver notifications and deletes projection records. It cannot erase data already observed by the caregiver.

## Queries/indexes

`doseEvents` history dùng index `scheduledLocalDate DESC + scheduledLocalTime DESC + __name__ DESC`; source đã được thêm vào `firestore.indexes.json` nhưng **chưa được deploy**. Việc deploy index cần phê duyệt riêng cùng với Rules M3.4, vì production phải được đối chiếu trước. Các index dự kiến khác gồm `status + scheduledAt`, active medications (`status + updatedAt`), future trusted schedule occurrence metadata và notification delivery (`deliveryState + scheduledFor`).

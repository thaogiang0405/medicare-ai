# Medication Schedules — Migration 3.3

## Phạm vi

M3.3 cho phép chủ hồ sơ `elderly` quản lý nhiều lịch uống cho từng thuốc đang
`active`: chọn giờ địa phương `HH:mm`, lặp hằng ngày hoặc theo các thứ, ngày bắt
đầu, ngày kết thúc tùy chọn, chỉnh sửa và tạm dừng. UI không suy luận liều dùng,
giờ uống hoặc tần suất từ tên/hướng dẫn thuốc.

Schedule dùng model độc lập Firebase tại
`elderlyProfiles/{auth.uid}/medicationSchedules/{scheduleId}`. Schema client
gồm `ownerUid`, `medicationId`, `recurrence`, `localTime`, `weekdays`,
`startDate`, `endDate`, `timeZone`, `active`, `revision`, `createdAt` và
`updatedAt`. `timeZone` cố định là `Asia/Ho_Chi_Minh`; date-only giữ dạng
`YYYY-MM-DD` để không đổi ngày ngoài ý muốn khi chuyển UTC.

## Repository và feature flag

- Khi `EXPO_PUBLIC_FIRESTORE_SCHEDULES_ENABLED` không phải `true`, app dùng
  `MockMedicationScheduleRepository` in-memory, cô lập theo UID và không
  persist sau khi khởi động lại.
- Khi cờ local được bật, `FirestoreMedicationScheduleRepository` xác minh UID
  từ Firebase Auth trước/sau mỗi request và dùng Firestore transaction để tăng
  `revision` khi sửa/tạm dừng.
- Cờ là public routing flag, không phải quyền. Không commit `.env`; thêm cờ
  mặc định `false` trong `.env.example`.

## Security Rules local

Source `firestore.rules` M3.3 chỉ bổ sung `get/list/create/update` trên
`elderlyProfiles/{auth.uid}/medicationSchedules/{scheduleId}` cho owner có
profile `elderly` hợp lệ. Create yêu cầu medication cùng owner đang `active`.
Rules enforce exact schema, real calendar date trong phạm vi 2000–2099, giờ
`HH:mm`, weekdays không lặp, IANA timezone, server timestamps, revision,
immutable `ownerUid`/`medicationId`/`createdAt`, và transition `active →
inactive`. Delete, reactivation, caregiver, cross-user, DoseEvent, notification
và collection chưa phê duyệt đều bị từ chối.

Rules M3.3 **chưa được deploy**. Không bật schedule feature flag cho production
cho đến khi review, preflight, rollback snapshot và deploy riêng được phê duyệt.

## Giới hạn còn lại

- DoseEvent trên dashboard vẫn là demo, tách biệt hoàn toàn với schedule.
- Chưa có local notification, FCM, background scheduler, `nextOccurrenceAt`,
  dose history thật hoặc Firestore index mới.
- Không có caregiver medication/schedule access, OCR, prescription-derived
  schedule hay dữ liệu sức khỏe thật.

## Checklist iPhone sau khi Rules M3.3 được deploy riêng

1. Trong `.env` local bị ignore, giữ Firebase config hiện có và bật
   `EXPO_PUBLIC_FIRESTORE_SCHEDULES_ENABLED=true` cùng flags cần thiết.
2. Đăng nhập tài khoản `elderly` thử nghiệm có medication `active`; mở chi tiết
   thuốc → **Quản lý lịch uống** → thêm một lịch dữ liệu giả.
3. Xác nhận document đúng path owner, chỉnh sửa, tạm dừng và khởi động lại app
   để kiểm tra persistence.
4. Đổi giữa hai tài khoản elderly để xác nhận dữ liệu không trộn; caregiver
   không được mở route hoặc đọc schedule.
5. Xác nhận DoseEvent demo và các nút Đã uống/Bỏ qua/Nhắc lại vẫn độc lập.

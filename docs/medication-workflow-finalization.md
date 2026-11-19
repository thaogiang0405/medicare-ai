# Hoàn thiện Medication, Dose Tracking và Reminder

## Phạm vi

Luồng non-AI của Expo gồm Medication → Schedule → Dashboard hôm nay → phản hồi
tự báo → local reminder → lịch sử phản hồi. Các UI chỉ dành cho profile
`elderly` đã xác thực; UI không truyền UID để chọn dữ liệu của người khác.

- Medication/schedule inactive bị loại khỏi lịch hôm nay và horizon reminder.
- DoseEvent là phản hồi tự báo create-only. Mỗi occurrence có ID xác định theo
  `scheduleId + localDate + localTime`; client không sửa/xóa record đã xác nhận.
- Sửa giờ lịch sau khi đã có phản hồi cùng ngày không gắn bản ghi cũ vào giờ mới
  hoặc tạo phản hồi thứ hai trong UI. Bản ghi cũ còn trong lịch sử với snapshot.
- History chỉ đọc collection con của owner, phân trang tối đa 30 record/lần cho
  hôm nay, 7 ngày hoặc 30 ngày. “Chưa phản hồi” không có nghĩa bỏ liều.

## Cờ local

Các cờ sau là public Expo build-time flags, không phải authorization và mặc định
`false` trong `.env.example`:

- `EXPO_PUBLIC_FIRESTORE_MEDICATIONS_ENABLED`
- `EXPO_PUBLIC_FIRESTORE_SCHEDULES_ENABLED`
- `EXPO_PUBLIC_FIRESTORE_DOSE_EVENTS_ENABLED`
- `EXPO_PUBLIC_LOCAL_REMINDERS_ENABLED`

`.env` local không được commit. Chỉ bật các cờ trên với Firebase Rules/index đã
deploy và tài khoản test không có dữ liệu sức khỏe thật.

## Reminder cục bộ

Người dùng tự bấm bật trước khi iOS được hỏi quyền. Consent gắn với UID và thiết
bị. Tắt reminder chỉ hủy notification ID MediCare AI đã mapping cho UID đó và
thu hồi consent local; không gọi `cancelAll` và không hủy notification của app/
account khác.

Horizon là 14 ngày, tối đa 48 notification pending do MediCare AI lập; occurrence
sớm được ưu tiên và notification đang chờ khác được tính vào capacity. Nội dung
lock-screen/payload không có tên thuốc, liều hoặc dữ liệu sức khỏe. App refill
horizon khi dữ liệu đổi, trở lại foreground, qua ngày HCM hoặc người dùng đồng
bộ tay. Không có FCM, APNs remote, background server scheduler, và không đảm
bảo nhắc đúng giờ nếu app không được mở lâu hoặc OS loại bỏ notification.

## Điều kiện Firebase trước khi bật DoseEvent/History

Source `firestore.rules` M3.4 giới hạn `doseEvents` cho owner elderly, có profile
hợp lệ, với `get/list/create` và exact schema; update/delete/caregiver/cross-user
vẫn deny. Rules bind UTC timestamp với ngày/giờ Asia/Ho_Chi_Minh và recurrence
daily/weekly của schedule đã lưu. Tuy nhiên Rules không tạo nguồn occurrence
server-trusted hoặc chứng minh hành vi uống thuốc, nên phản hồi vẫn luôn là
self-report, không phải xác nhận y tế hay bằng chứng người dùng đã uống thuốc.

Lịch sử cần composite index local trong `firestore.indexes.json`:
`scheduledLocalDate DESC + scheduledLocalTime DESC + __name__ DESC` cho
`doseEvents`. Rules/index này không được deploy tự động trong đợt này. Trước khi
bật DoseEvent flag, chủ dự án phải review source, đối chiếu Rules production,
deploy Rules và index theo quy trình được phê duyệt, sau đó kiểm thử bằng account
test.

## Checklist iPhone (Expo Go SDK 58)

1. Dùng elderly test account, bật Medication/Schedule/DoseEvent/Reminder flags
   trong `.env` local sau khi backend đã được phê duyệt, rồi chạy
   `npx expo start --clear --lan`.
2. Thêm/sửa/tạm dừng Medication và Schedule; về Home/foreground để xác nhận
   lịch active cập nhật, schedule inactive không còn xuất hiện.
3. Sau giờ dự kiến, thử Đã uống/Bỏ qua, kiểm tra hộp xác nhận, Firestore document
   owner path, restart/relogin và History 1/7/30 ngày. Không coi “chưa phản hồi”
   là liều bỏ quên.
4. Vào **Cài đặt nhắc lịch**, cấp/từ chối quyền, bật/tắt/bật lại, đồng bộ, kiểm
   tra nội dung notification chung chung; thử đổi account để bảo đảm reminder cũ
   bị hủy đúng account.
5. Dùng caregiver hoặc elderly test account thứ hai để xác nhận route/dữ liệu
   không lẫn. Không dùng dữ liệu thuốc hoặc sức khỏe thật.

# QA một lượt – Expo caregiver cơ bản + OCR/TTS

Nhánh thử nghiệm: `feature/caregiver-demo-schedule` (PR #6); nền `migration/expo-sdk58` đã tích hợp quét đơn, quét bao bì, lịch thuốc và giọng Việt. Nhánh thử nghiệm còn bổ sung 4 test giọng đọc từ PR #5.

## Tự động

Chạy tại `expo-app/`, trên nhánh thử nghiệm. Nếu máy đang dùng bộ package đã cài cho Expo SDK 58 thì không cần `npm ci`.

```cmd
npm run typecheck && npm run lint && npm test
```

Lệnh kết hợp sẽ dừng ở lỗi đầu tiên. Trước khi xử lý TypeScript thiếu type route mới, chạy Expo một lần để tạo lại `.expo/types/router.d.ts`.

## Kiểm tra tất cả chức năng trên iPhone

- Đăng nhập vai trò **Người chăm sóc**. Kiểm tra banner **Chế độ trình diễn** và **Hồ sơ minh họa**; không có hồ sơ thật nào được chia sẻ.
- Mở **Theo dõi lịch thuốc**, xem ba mốc mẫu, chọn **Chỉ xem chưa phản hồi**, quay lại xem tất cả, rồi đóng mục. Không suy diễn **Chưa phản hồi** thành **Bỏ liều**.
- Mở **Nhắc người thân**, chuyển giữa hai câu mẫu, kiểm tra nội dung không chứa tên/hàm lượng thuốc. Bấm **Mở bảng chia sẻ lời nhắc**, thử đóng bảng chia sẻ và xác nhận app không báo đã gửi. Chỉ tự gửi bằng ứng dụng được chọn nếu muốn.
- Mở **Liên kết hồ sơ**, đọc cảnh báo **Chưa cấp quyền**, bấm mở bảng chia sẻ lời mời. Kiểm tra không có thao tác tự liên kết, chấp thuận hoặc đọc dữ liệu của người cao tuổi khác.
- Đăng xuất; kiểm tra không còn ở dashboard caregiver.
- Đăng nhập vai trò **Người cao tuổi**. Thử quét bao bì Acetaminophen 500 mg, OCR đơn thuốc, danh sách/lịch thuốc, đánh dấu đã uống/bỏ qua (chỉ ở dữ liệu thử phù hợp), lịch sử và bật/tắt nhắc thuốc cục bộ nếu đã thiết lập. Thử phát/dừng giọng đọc rồi rời màn hình. Không lưu OCR sai.

**Ranh giới an toàn:** Không có Firestore cross-account read/write, không kích hoạt invite/approve/revoke thật, không FCM/SMS tự động, không thay đổi Firebase Rules hoặc billing. Chia sẻ chỉ mở bảng native Share; người dùng quyết định có gửi qua ứng dụng khác. Bộ Jest không kiểm định khả năng gửi tin nhắn hay độ chính xác OCR trên máy thật.

Nếu có lỗi, gửi **đoạn lỗi đầu tiên** và chức năng đang thử; không cần chạy từng feature trên những nhánh khác.

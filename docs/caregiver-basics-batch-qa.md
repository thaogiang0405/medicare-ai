# Kiểm thử một lượt – Lịch thuốc do người cao tuổi chủ động chia sẻ

## Đã triển khai (nhánh PR #6)

1. **Người cao tuổi**: Nút **Chia sẻ lịch thuốc hôm nay** chỉ xuất hiện khi đã đăng nhập đúng vai trò, danh sách lịch thật trên Firestore đã tải, không lỗi và có ít nhất một mốc hợp lệ hôm nay. Khi bấm, app giải thích quyền riêng tư; chỉ bấm **Tôi đồng ý — mở bảng chia sẻ** mới gọi bảng chia sẻ iOS/Android.
2. Bản chia sẻ là văn bản có định dạng `MEDICARE-AI-LICH-THUOC-V1`, chứa **ngày**, tối đa **20** tên thuốc và **giờ dự kiến** đang hiển thị. Không kèm UID, tên người, hàm lượng, hướng dẫn dùng, dữ liệu OCR, hình ảnh hay phản hồi đã uống.
3. **Người chăm sóc**: Mở **Theo dõi lịch thuốc**, dán toàn bộ bản sao được người cao tuổi gửi, bấm **Đọc bản lịch đã dán**. App kiểm tra cấu trúc, ngày giờ và độ dài, hiện từng giờ/tên, cho phép xóa, giữ trong bộ nhớ màn hình và xóa khi đổi tài khoản hoặc đăng xuất. **Không còn ba thuốc mẫu A/B/C** trên giao diện.
4. **Nhắc người thân**: Hai lời nhắn hỏi thăm chung. Chỉ mở bảng chia sẻ khi chủ động bấm, không tự gửi. **Liên kết hồ sơ**: thông tin về việc xin đồng ý và mẫu lời đề nghị trao đổi; không cấp quyền online.

## Giới hạn bảo mật và riêng tư

- Bản sao có thể bị chỉnh sửa trước khi người chăm sóc dán: định dạng **không được ký điện tử** và **không xác minh nguồn gửi**. Đây là thông tin tham khảo do người dùng tự chia sẻ, không phải dữ liệu được ứng dụng xác minh trực tuyến. Không kết luận bệnh nhân đã uống/chưa uống.
- Nội dung gửi qua ứng dụng khác có thể được lưu và chuyển tiếp; chỉ chia sẻ với người nhận tin cậy sau khi cân nhắc. Đóng bảng chia sẻ không được xem là đã gửi thành công.
- Bản sao **không tự đồng bộ**. Lịch hoặc thuốc thay đổi cần gửi bản mới. Không nhắn SMS/FCM/push tự động, không tạo hoặc duyệt yêu cầu liên kết thật.
- Không đọc/ghi Firestore giữa tài khoản, không thay đổi Firebase Rules, Indexes, Cloud Functions, Billing hay `main`. Liên kết thật cần thiết kế phân quyền server-trusted và kiểm thử Rules riêng.
- Nút chia sẻ của người cao tuổi phụ thuộc chế độ **Thuốc + Lịch thuốc Firestore** đã có từ trước. Chỉ bật `EXPO_PUBLIC_FIRESTORE_MEDICATIONS_ENABLED` và `EXPO_PUBLIC_FIRESTORE_SCHEDULES_ENABLED` sau khi kiểm tra Rules production và dùng tài khoản test; nếu chưa có, nút không xuất hiện. **Không tự triển khai/deploy Rules chỉ để thử UI.**

## Kiểm tra tự động trên Windows

Đứng ở thư mục `expo-app/`, nhánh `feature/caregiver-demo-schedule`:

```cmd
npm run typecheck && npm run lint && npm test
```

Các test trong PR gồm định dạng dữ liệu chia sẻ, lỗi nhập liệu, quyền đồng ý trước khi chia sẻ, thay đổi nội dung cần đồng ý lại, thao tác caregiver, và regression giọng đọc tiếng Việt. Jest không thay thế kiểm thử iPhone.

## Một lượt kiểm thử trên iPhone

1. Đăng nhập **Người cao tuổi** bằng tài khoản thử có lịch và thuốc thực sự được lưu ở Firestore, không dùng dữ liệu y tế cá nhân. Đối chiếu **Lịch thuốc hôm nay** trên màn hình.
2. Bấm **Chia sẻ lịch thuốc hôm nay**: lần bấm đầu **chỉ mở cảnh báo**, không bật Share. Bấm **Tôi đồng ý — mở bảng chia sẻ**, gửi cho chính bạn bằng ứng dụng tin cậy hoặc Sao chép văn bản. Nội dung gồm ngày + giờ + tên của chính các mốc đã hiển thị.
3. Đăng nhập tài khoản thử **Người chăm sóc**. Mở **Theo dõi lịch thuốc**, dán toàn bộ văn bản vừa nhận, bấm **Đọc bản lịch đã dán**. Kiểm tra ngày, giờ, tên khớp bản xuất; không có thuốc mẫu A/B/C, không suy ra đã uống hoặc bỏ qua.
4. Dán chuỗi bị cắt hoặc sai cấu trúc → phải báo lỗi; thử **Xóa bản lịch đã nhập**, đăng xuất/đổi tài khoản → dữ liệu cũ không xuất hiện lại.
5. Thử **Nhắc người thân** và **Liên kết hồ sơ** → chỉ mở thông điệp chia sẻ khi bấm, không có quyền xem dữ liệu online của người khác.
6. Kiểm tra hồi quy vai trò elderly: quản lý thuốc, lịch thuốc, Quét đơn thuốc, Quét vỏ hộp thuốc Acetaminophen 500 mg, nghe/dừng lịch tiếng Việt; chỉ thử DoseEvent, lịch sử và nhắc cục bộ nếu các feature flags + backend đã sẵn sàng.

Khi gặp lỗi, gửi **lỗi đầu tiên** ở terminal hoặc ảnh màn hình cùng bước đang thử. Không cần chuyển sang PR #5 vì test giọng đọc đã được đưa vào nhánh PR #6.

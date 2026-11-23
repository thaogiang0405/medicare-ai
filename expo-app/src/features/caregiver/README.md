# Caregiver / Người chăm sóc

Các thao tác cơ bản trong Expo Go:

- **Theo dõi lịch thuốc**: mở/ẩn lịch cố định **minh họa**, lọc các mốc chưa phản hồi, phân biệt tự báo đã uống/bỏ qua/chưa phản hồi. Không lấy dữ liệu người cao tuổi khác.
- **Nhắc người thân**: chọn một trong hai câu mẫu chung rồi **chủ động** mở bảng chia sẻ gốc của iOS/Android. Không gửi SMS, email, FCM hoặc push tự động; không xác nhận đã gửi.
- **Liên kết hồ sơ**: giải thích yêu cầu đồng ý và cho phép soạn tin nhắn trao đổi ngoài ứng dụng. **Không tạo/duyệt/cấp quyền liên kết**, không dùng mã thật, không ghi Firestore.
- **Đăng xuất**: dùng chung session hiện có.

Để có liên kết gia đình thật phải có giao dịch server-trusted cho invite/approve/revoke, quyền caregiver trong Security Rules và dữ liệu kiểm thử phù hợp. Giao diện minh họa này cố ý không giả lập quyền thật.

# Family Care: nhập bản lịch đã chia sẻ thủ công

MediCare AI chưa cấp quyền **Người chăm sóc** truy cập Firestore của người cao tuổi khác. Để dùng **dữ liệu lịch thật** trong đợt thử nghiệm miễn phí, owner **chủ động** chia sẻ một bản lịch hiện có; caregiver dán văn bản đó và đọc bản sao **chỉ trên thiết bị đang dùng**.

- **Người cao tuổi**: khi chế độ Firestore Medication + Schedule đã bật, tải thành công và hôm nay có lịch, nút **Chia sẻ lịch thuốc hôm nay** xuất hiện; trước khi mở bảng chia sẻ phải xem cảnh báo và bấm đồng ý.
- Bản chia sẻ là tin nhắn **tiếng Việt dễ đọc trực tiếp trong Zalo/Messenger** (`LỊCH THUỐC DỰ KIẾN - MediCare AI`, ngày, các dòng `08:00 — Tên thuốc`), không còn chuỗi JSON. Người gửi chọn ứng dụng bằng bảng chia sẻ của hệ điều hành; bản V1 cũ vẫn nhập được. Nội dung chỉ có ngày, tên và giờ dự kiến; không có dose, UID, dữ liệu uống, hình ảnh hoặc hướng dẫn. Tối đa 20 mục; không tự chia sẻ khi đang tải hoặc lỗi.
- **Người chăm sóc**: sao chép toàn bộ tin nhắn nhận từ ứng dụng nhắn tin và dán nội dung đã nhận, bấm đọc để kiểm tra, xem danh sách và xóa. Lưu tạm bằng React state; không có lưu trữ Firestore/AsyncStorage; xóa khi đổi account/sign out.
- **Nhắc người thân**: tạo lời nhắn chung, mở bảng Share khi người dùng bấm.
- **Liên kết hồ sơ**: chỉ hỗ trợ trao đổi về việc xin phép; không thực hiện invite/approval/revoke, không xác minh người gửi của bản chia sẻ và không mở quyền đọc tài khoản khác.

**Không có liên kết hay đồng bộ thật.** Chỉ nên chia sẻ với người nhận tin cậy. Để liên kết qua Firebase cần triển khai server-trusted invitation/approval/revocation và kiểm thử Rules theo tài liệu `docs/firestore-data-model.md`; không deploy tự động. Xem checklist `docs/caregiver-basics-batch-qa.md`.

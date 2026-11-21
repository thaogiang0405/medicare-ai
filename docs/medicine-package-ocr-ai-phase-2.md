# AI Phase 2 – Quét chữ trên bao bì thuốc (0đ)

Đây là OCR đọc chữ in trên hộp/vỉ bằng Tesseract.js đã có, **không phải nhận dạng viên thuốc bằng hình dạng/màu sắc hay xác minh thuốc thật giả**. Không sử dụng API ngoài, Cloud Vision, Cloud Functions, hoặc gói Blaze.

- Mỗi ảnh chỉ gợi ý tối đa một tên thuốc/hàm lượng có bằng chứng trên nhãn.
- Các mục gợi ý phải **tự tích chọn** sau khi kiểm tra bao bì thật mới lưu được.
- Không tự điền hướng dẫn sử dụng, liều, tần suất hay lịch uống.
- Ảnh không nhận dạng được chỉ hiển thị OCR gốc để người dùng xem và nhập thủ công.
- Khi xác nhận, Medication Repository hiện có xử lý lưu và chống trùng; không tự tạo lịch.
- Bản nháp lưu trong bộ nhớ, xóa khi hủy/đổi tài khoản như luồng đơn thuốc.

QA: đặt `EXPO_PUBLIC_PRESCRIPTION_OCR_ENABLED=true` trong .env local, chạy Expo Go SDK 58, mở **Quét vỏ hộp thuốc**. Dùng ảnh giả có 'Tên thuốc: Paracetamol 500 mg' hoặc 'Vitamin C 500 mg'. Xác nhận mục đề xuất ban đầu không chọn, hướng dẫn trống, các dòng HSD/số lô/thành phần không tạo thẻ, hủy/retry/đổi UID hoạt động. Kiểm tra regression của Quét đơn thuốc.

Chưa kiểm thử màn bao bì trên iPhone hoặc chạy đầy đủ Jest/TypeScript ở nhánh này. Không merge trước QA.

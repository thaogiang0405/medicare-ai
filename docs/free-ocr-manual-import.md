# OCR miễn phí trong MediCare AI (chế độ Live Text)

## Mục tiêu

MediCare AI giữ Firebase Spark và không triển khai Google Cloud Vision hoặc Cloud Functions. Người dùng iPhone có thể dùng **Live Text trong ứng dụng Ảnh của iOS** để lấy chữ từ ảnh đơn thuốc, dán vào màn hình **Quét đơn thuốc**, và sử dụng parser/khâu rà soát và lưu thuốc đã có. Không cần billing hay API OCR trả phí.

## Cách thử trên iPhone

1. Bảo đảm `EXPO_PUBLIC_PRESCRIPTION_OCR_ENABLED=false` (không mở tính năng OCR cloud).
2. Đăng nhập tài khoản elderly trên Expo Go, mở **Quét đơn thuốc**.
3. Mở ảnh đơn thuốc **giả lập** trong Photos. Nếu máy hỗ trợ Live Text, chọn chữ rồi **Copy**.
4. Quay lại MediCare AI, dán vào **Nội dung đơn thuốc** rồi bấm **Kiểm tra và tách thông tin thuốc**.
5. Rà soát tên, hàm lượng, chỉ dẫn, chọn các mục cần lưu, nhấn xác nhận. Không tự tạo lịch hay chỉ định điều trị.
6. Hủy hoặc đăng xuất phải làm sạch bản nháp văn bản trong bộ nhớ. Thử đổi tài khoản và xác minh tách biệt dữ liệu.

## Giới hạn và bảo mật

- Đây là tính năng **nhập văn bản được OCR bằng iOS** (do người dùng sao chép), **không phải quét ảnh OCR tự động trong ứng dụng**.
- Văn bản và kết quả parser chỉ lưu trong RAM phiên hiện tại, không gửi ảnh/chữ đến Google Cloud Vision.
- Khi người dùng xác nhận lưu, các trường thuốc được ghi qua Medication Repository hiện hữu; nếu bật Firestore Medications, bản ghi thuốc được lưu vào Firestore như trước.
- Chữ viết tay, nhận dạng sai hoặc văn bản không chia thành dòng thuốc cần nhập/sửa thủ công và đối chiếu đơn gốc.
- Tesseract.js không chạy trực tiếp trong React Native/Hermes. Expo DOM/WebView là hướng nghiên cứu cho OCR tự động miễn phí, nhưng chưa được xác minh chạy ổn định và đóng gói đầy đủ WASM/mô hình tiếng Việt trên Expo Go iPhone. Không tự động bật hay tuyên bố hỗ trợ offline OCR ảnh.
- Cloud OCR source vẫn còn trong repo nhưng **không được deploy**; giữ `EXPO_PUBLIC_PRESCRIPTION_OCR_ENABLED=false` để tránh gọi dịch vụ có phí.

## Kiểm thử

Kiểm thử store tự động mới kiểm tra không gọi gateway OCR, xử lý nhập rỗng/quá dài, và xóa draft khi đổi UID. Cần chạy toàn bộ Jest/TypeScript/lint/Doctor trên máy cài Expo; đồng thời làm QA iPhone thật. Không có bằng chứng thiết bị iPhone đã được kiểm thử chỉ từ commit này.

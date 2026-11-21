# Nhập đơn thuốc miễn phí: OCR cục bộ và Live Text

MediCare AI giữ Firebase Spark và không gọi Google Cloud Vision, Cloud
Functions, OpenAI hay một OCR API thương mại. Có hai lựa chọn miễn phí:

1. **OCR cục bộ Tesseract.js** — bật riêng `EXPO_PUBLIC_PRESCRIPTION_OCR_ENABLED=true`
   trong `.env` local sau khi engine `vie`/`eng` đã được QA trên thiết bị.
2. **Live Text / nhập tay** — luôn có thể dùng trên iPhone, kể cả khi OCR cục
   bộ bị tắt hoặc không khởi tạo được.

## Live Text trên iPhone

1. Mở ảnh đơn thuốc tổng hợp trong ứng dụng **Ảnh**.
2. Chọn chữ bằng Live Text, sau đó chọn **Sao chép**.
3. Vào **Quét đơn thuốc** trong MediCare AI.
4. Dán nội dung vào phần **Dán văn bản bằng Live Text**.
5. Kiểm tra, chỉnh sửa, chọn candidate rồi mới xác nhận lưu.

Không có ảnh/chữ được gửi tới Cloud Vision. Văn bản dán, parser output và
candidate chỉ sống trong RAM của phiên hiện tại; đổi tài khoản, logout, hủy
hoặc rời màn hình sẽ xóa draft.

## Điều cần nhớ

- Live Text là text do người dùng chủ động sao chép; không phải xác nhận y tế.
- OCR cục bộ/Live Text có thể sai chữ, đặc biệt với đơn viết tay hoặc ảnh mờ.
- Không tự tạo thuốc, liều, lịch uống hoặc reminder từ kết quả nhận dạng.
- Chỉ dùng ảnh tổng hợp, không dùng đơn thuốc/dữ liệu sức khỏe thật trong QA.
- Chi tiết runtime Tesseract, bundle asset và QA Expo Go nằm trong
  [AI Phase 1 — Prescription OCR](prescription-ocr-ai-phase-1.md).

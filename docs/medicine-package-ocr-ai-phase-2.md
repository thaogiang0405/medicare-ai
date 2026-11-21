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

## Khi tên thuốc in lớn nhưng OCR toàn ảnh đọc sai

Trong màn **Quét vỏ hộp thuốc**, chọn ảnh bao bì, **chạm chính giữa dòng tên thuốc/hàm lượng** trên ảnh để hiện dải khung xanh. Nhấn **Chỉ quét vùng tên đã chọn**. Ứng dụng dùng Expo ImageManipulator để cắt dải ngang khoảng 22% chiều cao ảnh trong cache cục bộ (không tải lên server), thay ảnh xem trước bằng dải đã cắt rồi dùng Tesseract chế độ single-line khi nhấn **Nhận dạng chữ trên thiết bị**. Vùng cắt phải hiển thị trọn tên và hàm lượng; nếu cắt thiếu hãy **Thay ảnh** và chọn lại. Chưa thể đảm bảo chính xác 100% trên mọi loại bao bì.

Bắt buộc kiểm tra: OCR của chữ tên lớn, chữ có dấu, ảnh nghiêng/nhòe, chữ lớn có phông đậm, ảnh chỉ có nhãn phụ; không được tự tạo tên/liều/giờ uống khi OCR không nhận ra. Người dùng phải chủ động tích chọn gợi ý.

Có thêm unit test cho giới hạn vùng cắt và vị trí chạm. Cần chạy toàn bộ Jest, TypeScript/lint trên máy phát triển và kiểm thử tương tác chạm/cắt thực tế trong Expo Go iPhone. Nếu thông báo Expo `Uncaught (in promise...)` còn xuất hiện, lấy stack trace đầy đủ từ Metro; toast bị cắt không đủ để xác định chính xác nguồn lỗi.

## Bản sửa theo QA iPhone (lỗi DomWebView và "Paracetamol SOO")

- Đã nhận log Expo Go `Unable to find the 'DomWebView' view with tag ...`. Sử dụng `react-native-webview` đã cài và `dom={{ useExpoDOMWebView: false }}` theo hướng dẫn chính thức Expo SDK 56+, tránh phụ thuộc vào native DomWebView mặc định. Cleanup không setState khi WebView unmount, nhằm giảm race với bridge.
- Phần quét bao bì có lượt tăng tương phản `canvas` ở DOM, hoàn toàn trên thiết bị, chỉ áp dụng khi ảnh được cắt thành dải tên/hàm lượng. Lượt OCR gốc vẫn giữ để dự phòng nếu thao tác preprocessing thất bại.
- Chỉ ưu tiên kết quả đã tăng tương phản khi nó **thật sự nhận được** dòng tên cùng một hàm lượng có đơn vị. Tuyệt đối không chuyển chuỗi OCR `SOO` thành `500 mg` bằng quy tắc suy đoán.
- Khung chọn trong ảnh giờ hẹp hơn với ảnh hộp đầy đủ để giảm nhiễu dòng phụ; dải ngang đã cắt sẵn vẫn giữ chiều cao đủ cho chữ nghiêng. Ảnh dải ngang đủ rộng sẽ không bị cảnh báo độ phân giải thấp chỉ vì chiều cao ít.
- Nếu nút **Chỉ quét vùng tên đã chọn** bị xám: **chạm vào chính giữa chữ** trong ảnh trước để hiện khung chọn, rồi nhấn nút đó, cuối cùng mới bấm **Nhận dạng chữ trên thiết bị**.
- Phần code này **chưa chạy lại Jest/TypeScript trên máy Windows**, chưa xác nhận iPhone hết lỗi. Khi thử lại, chạy `npm run typecheck`, `npm run lint`, `npm test` rồi `npx expo start --clear --lan`. Ghi lại log Metro nếu còn lỗi.

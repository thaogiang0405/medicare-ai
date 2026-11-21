# AI Phase 1 — OCR đơn thuốc cục bộ, miễn phí

MediCare AI xử lý ảnh đơn thuốc theo nguyên tắc **xem lại trước khi lưu**.
OCR chỉ gợi ý văn bản và các mục thuốc để người dùng chỉnh sửa, chọn và xác
nhận. Ứng dụng không suy luận liều dùng, không tạo lịch uống và không thay thế
chỉ định của bác sĩ.

## Trạng thái hiện tại

- OCR ảnh tự động dùng **Tesseract.js 6.0.1** trong Expo DOM/WebView, không
  import Tesseract vào React Native/Hermes.
- Worker, WASM core và mô hình `vie` + `eng` được vendor trong
  `expo-app/public/ocr/`; runtime không dùng Cloud Vision, Firebase Functions,
  Firebase Storage, OpenAI, hay một API OCR thương mại.
- `EXPO_PUBLIC_PRESCRIPTION_OCR_ENABLED=false` vẫn là mặc định an toàn. Đây là
  cờ public, không phải cơ chế phân quyền hay secret.
- Firebase Callable/Cloud Vision source cũ còn trong repository để tham chiếu
  lịch sử, nhưng không nằm trong composition runtime OCR, không được export từ
  feature barrel và **không được deploy** trong hướng đi này.
- Live Text của iOS và nhập tay vẫn là fallback miễn phí khi engine cục bộ
  chưa sẵn sàng hoặc người dùng muốn tự đối chiếu văn bản.

## Quy trình dữ liệu và quyền riêng tư

1. Route `/elderly/prescription-ocr` vẫn được route guard của `elderly` bảo vệ.
2. Người dùng chụp/chọn tối đa ba ảnh. Ảnh được xoay/thu nhỏ thành JPEG cache
   tạm thời, bỏ EXIF và giữ giới hạn 5 MiB/trang, 10 MiB/yêu cầu.
3. Người dùng xác nhận việc xử lý **trên thiết bị**. Base64 chỉ đi qua bridge
   native → DOM cho đúng một trang tại một thời điểm.
4. DOM runtime nạp script, worker, WASM và `vie`/`eng` từ các đường dẫn public
   cục bộ. `cacheMethod: 'none'`, worker bị `terminate()` khi hoàn tất, lỗi,
   hủy, logout hoặc đổi tài khoản.
5. OCR raw text, base64 và preview không được ghi vào AsyncStorage, Firestore,
   analytics hoặc log. Cache ảnh được xóa best-effort khi hủy/rời màn hình/đổi
   tài khoản.
6. Parser chỉ tạo candidate trong RAM. Chỉ candidate do người dùng chọn và
   xác nhận mới được chuyển tới Medication Repository hiện có.

Store gắn công việc với UID Firebase Auth hiện tại, dùng `AbortController` để
hủy worker khi session thay đổi, và bỏ mọi callback trễ bằng job ID + request
version. UID từ UI không phải nguồn ủy quyền.

## Tài nguyên OCR được vendor

`expo-app/public/ocr/NOTICE.md` ghi phiên bản, license, checksum và nguồn của
các asset. Bốn biến thể Tesseract core được giữ để runtime chọn WASM phù hợp
với thiết bị. Không thay các asset bằng CDN URL.

Khi chạy trong Expo Go development, bundle/public asset có thể được cung cấp
bởi Metro trên mạng LAN của máy phát triển; đó không phải dịch vụ OCR bên thứ
ba. Build/export đóng gói public assets cùng ứng dụng. OCR không có HTTP call
đến dịch vụ OCR; tuy vậy Expo Go vẫn cần kết nối Metro để mở project lần đầu.

## Bật kiểm thử cục bộ

Không đưa `.env` vào Git. Trên máy QA, sao chép `.env.example`, giữ Firebase
Web App client config hiện có, rồi đặt:

```dotenv
EXPO_PUBLIC_PRESCRIPTION_OCR_ENABLED=true
```

Chạy:

```bash
cd expo-app
npx expo start --clear --lan
```

Mở bằng Expo Go SDK 58. Chỉ dùng ảnh tổng hợp/không nhạy cảm. Checklist:

1. Chờ thông báo engine `vie`/`eng` cục bộ sẵn sàng.
2. Chụp hoặc chọn một đến ba ảnh rõ, kiểm tra tiến trình từng trang và nút
   **Dừng quét**.
3. Xác nhận mọi candidate, hàm lượng và hướng dẫn trước khi lưu.
4. Thử ảnh mờ/trống, hủy rồi thử lại, logout/đổi UID trong lúc xử lý.
5. Tắt mạng Internet sau khi Expo Go/asset local đã nạp để quan sát rằng OCR
   không gọi một dịch vụ OCR bên ngoài. Không coi đây là thay thế cho kiểm thử
   release build offline.

## Proof of concept và mức xác minh

Proof-of-concept Node đã tạo worker cục bộ, nạp `vie` + `eng`, dùng core/WASM
và model vendor, rồi nhận dạng ảnh tổng hợp tiếng Việt. Kết quả có dòng
`Paracetamol 500 mg` và `Uống sau ăn - cần kiểm tra`, confidence 94; tiêu đề
viết hoa mất dấu là giới hạn OCR đã quan sát, không phải dữ liệu y tế thật.
Chạy lại POC Windows bằng `npm run test:ocr:poc` trong `expo-app/`; script chỉ
tạo ảnh tổng hợp trong thư mục tạm rồi xóa nó trước khi thoát.

`expo-app/public/ocr/poc.html` cùng
`expo-app/scripts/serve-offline-ocr-poc.mjs` là POC browser dùng hoàn toàn
asset cục bộ. Có thể chạy bằng `node scripts/serve-offline-ocr-poc.mjs` trong
`expo-app/` rồi mở `http://127.0.0.1:4173/ocr/poc.html` trên máy phát triển.

**QA DEVICE NOT VERIFIED:** code bridge Expo DOM/WebView tương thích tài liệu
Expo SDK 58 và `react-native-webview` có trong Expo Go, nhưng lần chạy thực tế
trên iPhone/Expo Go phải do chủ dự án xác nhận riêng. Không tuyên bố offline
iPhone đã passed chỉ từ proof-of-concept Node hoặc unit test.

## Giới hạn và việc không triển khai

- Độ chính xác giảm với chữ viết tay, ảnh nghiêng/mờ, bố cục phức tạp hoặc
  tiếng Việt có dấu. Low confidence/blank result luôn yêu cầu kiểm tra tay.
- Không dùng OCR để tự tạo medication record, liều, schedule, DoseEvent hoặc
  reminder.
- Không có Cloud Function, Cloud Vision, billing/Blaze, Admin SDK, server OCR,
  FCM hay upload Storage trong feature OCR cục bộ.
- Không thay đổi Firestore Rules/indexes và không tạo dữ liệu sức khỏe thật.

Để cải thiện AI miễn phí sau này, chỉ cân nhắc engine native/open-source trong
development build sau khi có benchmark tiếng Việt, giới hạn bộ nhớ và review
quyền riêng tư; không thay OCR cục bộ bằng API trả phí.

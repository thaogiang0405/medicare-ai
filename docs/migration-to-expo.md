# MediCare AI — Kế hoạch Migration sang React Native + Expo

## Trạng thái và nguyên tắc bảo toàn

Migration 1 tạo ứng dụng mới trong `expo-app/` trên nhánh `migration/expo`.
Nền Flutter còn lại ở thư mục gốc không bị xóa, di chuyển, đổi package hay ghi
đè. Điểm tham chiếu an toàn trước migration là commit Phase 2.1:

```text
355c85d chore: configure Firebase Android integration - Phase 2.1
```

Mã Flutter, tài liệu nghiệp vụ, mô hình dữ liệu, Firebase Rules mẫu và lịch sử
Git tiếp tục là nguồn đối chiếu trong quá trình chuyển đổi. Không dùng reset,
clean, force push hoặc thay đổi lịch sử để thực hiện migration.

## Mục tiêu Migration 1

Ứng dụng Expo mới phục vụ kiểm thử sớm trên iPhone bằng Expo Go và giữ ranh
giới module để thay backend mock bằng Firebase sau này.

| Thành phần | Lựa chọn |
| --- | --- |
| Runtime | React Native + Expo SDK 57 |
| Ngôn ngữ | TypeScript `strict` |
| Điều hướng | Expo Router |
| State UI/domain | Zustand, chỉ trong bộ nhớ |
| Data layer | Repository pattern, mock implementation |
| Firebase | Chưa khởi tạo; chờ Web App configuration chính thức |

Mọi màn hình dùng tiếng Việt, font lớn, tương phản rõ và mục tiêu thao tác tối
thiểu 56 px. Trạng thái sức khỏe luôn có nhãn văn bản; ví dụ “Chưa phản hồi”
không được diễn giải là “chưa uống thuốc”.

## Luồng được chuyển đổi

```text
Splash → Onboarding → Đăng nhập / Đăng ký → Chọn vai trò
                                                   ├─ Người cao tuổi → Trang chủ
                                                   └─ Người chăm sóc → Dashboard
```

Các luồng trên là trình diễn bằng mock data. Đăng nhập/đăng ký không gọi
Firebase, không lưu thông tin đăng nhập và không xác minh danh tính. Dữ liệu
demo được tạo lại khi mở lại phiên ứng dụng.

## Cấu trúc dự kiến

```text
expo-app/
  src/app/                 # Route root Expo Router của template SDK 57
  src/
    components/            # Screen, button, card, form và accessibility UI
    constants/             # Color, spacing, typography, touch target
    features/
      auth/
      elderly/
      caregiver/
      medications/
      schedules/
      prescriptions/
      family/
    services/
      firebase/            # Contract/docs, chưa có client initializer
    store/                 # Zustand in-memory
    types/
    utils/
```

UI chỉ phụ thuộc vào domain/repository contracts. Khi Authentication và
Firestore được triển khai, một Firebase repository sẽ thay mock repository mà
không buộc routes hoặc components gọi SDK trực tiếp.

## Firebase và bảo mật

Firebase Project được tiếp tục sử dụng là `medicare-ai-cf804`. Cấu hình Android
Flutter hiện có không áp dụng trực tiếp cho Firebase JavaScript SDK:

- Không chuyển `lib/firebase_options.dart` thành TypeScript.
- Không tạo Firebase Project mới và không tự đăng ký Firebase Web App.
- Khi chủ project đã chọn/đăng ký Web App trong Firebase Console, dùng chính
  cấu hình client do Console/CLI cung cấp rồi mới khởi tạo SDK JavaScript.
- Không deploy Firestore/Storage Rules trong Migration 1.
- Không dùng Firebase Admin SDK trong ứng dụng Expo.

Expo Go chạy trong native container riêng. Khi tiến tới EAS/development build,
nhóm phải chọn Android/iOS bundle identifiers và đăng ký các Firebase client
apps phù hợp một cách có chủ đích; Migration 1 không tự dùng lại hoặc đổi
`com.medicareai.medicare_ai` của Flutter.

Cấu hình Firebase client công khai được thiết kế để xuất hiện trong app client,
nhưng service account JSON, private key, token, mật khẩu, keystore, provisioning
profile và file `.env` chứa bí mật không được đưa vào Git. Các giá trị nhạy cảm
chỉ được lưu trong secret manager hoặc môi trường phát triển cục bộ đã được
bảo vệ.

## Cài đặt và validation

Từ root repository:

```powershell
cd expo-app
npm install
npx expo-doctor
npx tsc --noEmit
npm test
npx expo start
```

`npm test` chỉ áp dụng khi test runner đã được cấu hình. `npx expo start` chỉ
xác minh rằng Metro có thể khởi động; nó không thay cho kiểm thử trên iPhone
hoặc Android.

Nếu Node.js hiện tại gây lỗi cho Expo SDK 57, ưu tiên thử Node.js 20 hoặc 22
LTS trước khi thay đổi dependency Expo.

## Kiểm thử Expo Go trên iPhone

1. Cài Expo Go từ App Store.
2. Kết nối iPhone và máy phát triển vào cùng Wi-Fi.
3. Chạy `npx expo start` trong `expo-app/` và quét QR code bằng Expo Go.
4. Cho phép quyền local network nếu iOS hỏi.
5. Nếu QR LAN không kết nối, dùng `npx expo start --tunnel`; tunnel cần Internet
   và có độ trễ cao hơn.

Chỉ ghi nhận ứng dụng đã chạy iOS sau khi màn hình đã mở thành công trên iPhone
thật. Migration 1 không tự tuyên bố có xác minh thiết bị đó.

## Không thuộc Migration 1

- Firebase Authentication thật, Firestore CRUD và hồ sơ người dùng.
- Medication/schedule backend hoặc Firestore Security Rules deployment.
- Camera/Image Picker/OCR, Text-to-Speech/Speech-to-Text.
- Notifications, Family Care Sync, FCM hoặc Firebase Storage.
- Release Android/iOS, EAS build và phát hành App Store/Google Play.

Các mục này là đầu vào cho Migration 2 hoặc milestone sau, sau khi Firebase Web
App configuration chính thức và chiến lược kiểm thử thiết bị đã được xác nhận.

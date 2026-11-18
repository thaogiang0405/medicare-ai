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
| Runtime | React Native + Expo SDK 58 |
| Ngôn ngữ | TypeScript `strict` |
| Điều hướng | Expo Router |
| State UI/domain | Zustand, chỉ trong bộ nhớ |
| Data layer | Repository pattern, mock implementation |
| Firebase | Migration 2.2 dùng Firebase Auth Email/Password với AsyncStorage persistence; M2.3 có User Profile owner-only đã deploy trên Firestore `(default)` (`asia-east1`), còn template feature flag mặc định tắt và chỉ opt-in qua `.env` local |

Mọi màn hình dùng tiếng Việt, font lớn, tương phản rõ và mục tiêu thao tác tối
thiểu 56 px. Trạng thái sức khỏe luôn có nhãn văn bản; ví dụ “Chưa phản hồi”
không được diễn giải là “chưa uống thuốc”.

## Luồng được chuyển đổi

```text
Splash → Onboarding → Đăng nhập / Đăng ký → Chọn vai trò
                                                   ├─ Người cao tuổi → Trang chủ
                                                   └─ Người chăm sóc → Dashboard
```

Đăng nhập/đăng ký hiện đi qua `FirebaseAuthRepository`; UI không gọi Firebase
SDK trực tiếp. Phiên được khôi phục bằng `onAuthStateChanged` và persistence
React Native do Firebase quản lý. Sau M2.3, role của profile `/users/{auth.uid}`
quyết định route UI khi feature được phê duyệt; thuốc, lịch và hồ sơ chia sẻ trên
dashboard vẫn là dữ liệu trình diễn. Không có phân quyền backend cho dữ liệu sức
khỏe hoặc dữ liệu y tế thật.

## Cấu trúc dự kiến

```text
expo-app/
  src/app/                 # Route root Expo Router của template SDK 58
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
      firebase/            # Core initializer và future Auth/Firestore boundaries
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
- Web App `MediCare AI Expo` đã được chọn trong Firebase Console. Firebase JS
  Core đọc đúng cấu hình client do Console/CLI cung cấp từ `.env` cục bộ; không
  có fallback project hoặc config giả.
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
npx expo-doctor@latest
npx expo lint
npx tsc --noEmit
npm test
npx expo export --platform ios
npx expo start --clear
```

`npm test` chỉ áp dụng khi test runner đã được cấu hình. `npx expo start --clear` chỉ
xác minh rằng Metro có thể khởi động; nó không thay cho kiểm thử trên iPhone
hoặc Android.

Nếu Node.js hiện tại gây lỗi cho Expo SDK 58, ưu tiên Node.js 22.13+ LTS trước
khi thay đổi dependency Expo.

## Kiểm thử Expo Go trên iPhone

1. Cài Expo Go từ App Store.
2. Kết nối iPhone và máy phát triển vào cùng Wi-Fi.
3. Chạy `npx expo start --clear` trong `expo-app/` và quét QR code bằng Expo Go SDK 58.
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

## Cập nhật SDK 58

Migration 1 được checkpoint cục bộ tại `e3e592e` trước khi nâng SDK. Nhánh
`migration/expo-sdk58` nâng Expo lên SDK 58, React Native `0.88.1`, React
`19.3.0` và Expo Router `~58.0.31` bằng Expo CLI. Không có native directory,
custom navigator, Router state persistence hay Firebase initializer cần migrate;
`src/app/` tiếp tục là route root. Không tự chạy `npm audit fix --force` vì các
đề xuất sửa của npm có thể yêu cầu thay đổi phiên bản xung đột với SDK đã ghim.

## Migration 2.1 — Firebase JavaScript SDK foundation

Firebase Web App `MediCare AI Expo` của project `medicare-ai-cf804` được xác
minh qua Firebase CLI. Expo đọc config bằng các biến `EXPO_PUBLIC_FIREBASE_*`
từ `expo-app/.env` bị Git ignore; `.env.example` chỉ mô tả biến cần điền. Core
initializer dùng Firebase modular `getApps()` / `getApp()` / `initializeApp()`
để chịu được Fast Refresh. `FirebaseInitializationGate` dừng luồng UI và hiển
thị lỗi phát triển nếu config không hợp lệ, thay vì âm thầm chạy một project hay
config khác.

Khi Migration 2.1 kết thúc, Auth và Firestore chỉ có composition boundary cho
Migration 2.2. Chưa có `firebase/auth`, `firebase/firestore`, repository
Firebase, persistence, CRUD, Rules deployment, Admin SDK hay dữ liệu y tế thật
trong scope M2.1. Xem
[`firebase-js-sdk-integration.md`](firebase-js-sdk-integration.md) để cấu hình
máy mới, giới hạn bảo mật và quy trình kiểm thử.

## Migration 2.2 — Firebase Authentication

Migration 2.2 thay mock authentication trong ứng dụng Expo bằng Firebase
Authentication Email/Password qua Firebase JavaScript SDK modular. Gói
`@react-native-async-storage/async-storage` được dùng với
`initializeAuth()` và `getReactNativePersistence()` trước bất kỳ fallback
`getAuth()` nào; Firebase quản lý credential persistence, còn Zustand chỉ giữ
trạng thái UI an toàn của phiên.

Luồng này đã được người kiểm thử xác nhận chạy thành công trên iPhone thật qua
Expo Go SDK 58. Kết quả chỉ xác minh Firebase Auth và navigation; Firestore,
phân quyền backend và dữ liệu sức khỏe vẫn chưa được triển khai.

`FirebaseAuthRepository` triển khai đăng ký, đăng nhập, đăng xuất, reset
password, cập nhật display name và `onAuthStateChanged`. Lỗi đăng nhập/reset
trả về thông báo trung tính để tránh tiết lộ email đã tồn tại hay chưa. Mật khẩu,
ID token và refresh token không được lưu trong source hoặc Zustand.

Root layout thêm auth initialization gate trước `Stack.Protected`. Người chưa
đăng nhập không vào được route dashboard; người đã đăng nhập không quay lại
route login/register qua navigation stack. Đây là chặn điều hướng phía client,
không thay thế Security Rules hay phân quyền server.

Trước kiểm thử người dùng thật, bật **Email/Password** trong Firebase Console →
Authentication → Sign-in method, đặt password policy phù hợp và xác nhận email
enumeration protection. Xem
[`firebase-authentication.md`](firebase-authentication.md) để biết quy trình
Expo Go, Console verification và giới hạn Migration 2.2.

Tại thời điểm kết thúc Migration 2.2, chưa có Firestore CRUD, profile
document/role persistence, authorization, Security Rules deployment, Admin SDK,
Cloud Functions, FCM hoặc dữ liệu sức khỏe thật. Đây là đầu vào có chủ đích cho
Migration 2.3 sau khi thiết kế schema, Rules và emulator test được phê duyệt.

## Migration 2.3 — Firestore User Profiles & Role Security

Migration 2.3 giữ nguyên Flutter ở root và không thay thế dữ liệu thuốc/lịch
mock. Nó thêm ranh giới repository Firestore chỉ cho `/users/{auth.uid}`:

- UID được lấy từ Firebase Auth, không từ UI; profile khởi tạo dùng transaction
  để không ghi đè role nếu hai thao tác cùng lúc.
- Schema chỉ có identity/display name, một `primaryRole`, roles map nhất quán,
  locale/timezone, onboarding flag và timestamps. Client không có API đổi UID,
  role, roles hay timestamp tạo.
- `Stack.Protected` chỉ mở role-selection cho profile thiếu, và chỉ mở dashboard
  đúng với persisted role. Đây là UX client-side; role không cấp quyền đọc dữ
  liệu sức khỏe.
- Rules M2.3 đã deploy chỉ cho owner `get/create/update` profile của chính mình; chặn
  list, delete, truy cập chéo và mọi surface thuốc/caregiver/family chưa có
  schema/workflow được duyệt.

Firestore `(default)` tại `asia-east1` đang dùng Rules M2.3 đã deploy bằng
lệnh có `--project medicare-ai-cf804`. Baseline deny-all trước deploy, checksum
và quy trình rollback được lưu tại
[`firestore-production-deny-all-baseline.md`](firestore-production-deny-all-baseline.md).
`EXPO_PUBLIC_FIRESTORE_USER_PROFILES_ENABLED` vẫn mặc định `false` trong
template. Cờ này không phải lớp bảo mật: nó chỉ cho phép chủ project opt-in
gọi profile Firestore trong `.env` cục bộ đã ignore sau kiểm thử có chủ đích.
Rules Emulator chạy bằng `npm run test:rules` với UID tổng hợp và không chạm
production.

Khi kiểm thử iPhone bằng tài khoản test, đặt cờ local thành `true`, restart
Expo và thu thập bằng chứng riêng cho role onboarding, persistence và đổi tài
khoản. Chủ project đã cho biết đã thực hiện kiểm thử User Profile trên iPhone,
nhưng kết quả từng trường hợp chưa được ghi nhận ở đây. Tài liệu chi tiết là
[`firestore-user-profiles.md`](firestore-user-profiles.md).

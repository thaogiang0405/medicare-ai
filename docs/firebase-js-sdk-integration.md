# MediCare AI — Firebase JavaScript SDK Integration (Migration 2.1)

## Phạm vi

Migration 2.1 kết nối Firebase JavaScript SDK modular với Firebase Web App
**MediCare AI Expo** trong project `medicare-ai-cf804`. Migration 2.2 bổ sung
Firebase Authentication Email/Password và React Native persistence. Firestore
CRUD, Security Rules deployment, Admin SDK, Cloud Functions, FCM và dữ liệu sức
khỏe thật vẫn chưa được triển khai.

Các màn hình Splash, Onboarding, Đăng nhập, Đăng ký, chọn vai trò, Elderly Home
và Caregiver Dashboard tiếp tục dùng mock repositories cho dữ liệu thuốc/lịch.
UI không import Firebase SDK trực tiếp.

## Cấu hình máy phát triển

1. Cài dependencies trong `expo-app/`:

   ```powershell
   npm install
   ```

2. Tạo `.env` từ template đã theo dõi:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Lấy cấu hình chính thức của Firebase Web App từ **Firebase Console → Project
   settings → General → Your apps → MediCare AI Expo → SDK setup and
   configuration → Config**, rồi điền các biến:

   ```text
   EXPO_PUBLIC_FIREBASE_API_KEY=
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
   EXPO_PUBLIC_FIREBASE_APP_ID=
   EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=
   ```

   Có thể kiểm tra lại bằng Firebase CLI đã đăng nhập, không tạo app mới:

   ```powershell
   firebase apps:list --project medicare-ai-cf804
   firebase apps:sdkconfig WEB <WEB_APP_ID> --project medicare-ai-cf804
   ```

Sáu biến đầu là bắt buộc. `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` là tùy chọn vì
Analytics không thuộc Migration 2.1.

## Khởi tạo và error handling

`expo-app/src/services/firebase/firebase-config.ts` kiểm tra config trước khi
tạo `FirebaseOptions`. `firebase-app.ts` dùng `getApps()`, `getApp()` và
`initializeApp()` để chỉ tạo default Firebase app một lần, kể cả khi Fast
Refresh đánh giá lại module. `FirebaseInitializationGate` chạy tại root layout
trước mọi route; lỗi cấu hình hiển thị rõ ràng trên thiết bị thay vì âm thầm
chuyển sang mock Firebase hoặc Firebase Project khác.

`firebase-auth-boundary.ts` khởi tạo Auth bằng `initializeAuth()` với React
Native AsyncStorage persistence trước khi bất kỳ `getAuth()` fallback nào được
dùng. `FirebaseAuthRepository` là adapter duy nhất cho Auth; nó dùng
`onAuthStateChanged` để khôi phục session, map `Firebase.User` sang `AppUser`
và không lưu password/token trong Zustand. `firestore-boundary.ts` vẫn không
import Firestore hay có read/write operation.

Xem [Firebase Authentication — Migration 2.2](firebase-authentication.md) để
bật Email/Password provider, password policy, email enumeration protection và
kiểm thử Expo Go trên iPhone.

## Bảo mật

Firebase Web config và API key client là định danh công khai dành cho ứng dụng
client, không phải service account. Tuy vậy, Expo nhúng toàn bộ biến
`EXPO_PUBLIC_*` vào bundle; không đưa password, token, service account JSON,
private key hoặc bất kỳ server credential nào vào `.env` hay source code.

`.env` bị ignore. Chỉ `.env.example` trống được version-control. Không dùng
`lib/firebase_options.dart` hoặc `android/app/google-services.json` của Flutter
cho TypeScript. Chưa deploy Firestore/Storage Rules và chưa có Firebase Admin
SDK trong Expo app.

## Kiểm thử

```powershell
npx expo-doctor@latest
npx expo lint
npx tsc --noEmit
npm test
npx expo export --platform ios
npx expo start --clear
```

Để kiểm thử thực tế trên iPhone, mở Expo Go SDK 58, bảo đảm iPhone và Windows
cùng Wi-Fi, quét QR từ `npx expo start --clear`, và thực hiện full reload. Nếu
Firebase config không hợp lệ, màn hình lỗi phát triển phải hiện ra. Nếu màn
hình Splash rồi luồng login/đăng ký xuất hiện bình thường, Firebase Core đã
khởi tạo trong runtime Expo Go. Để xác minh Auth thật, làm theo quy trình trong
[`firebase-authentication.md`](firebase-authentication.md); Firestore vẫn chưa
được xác minh hay sử dụng. Nếu LAN bị chặn, dùng `npx expo start --tunnel`.

## Advisory hiện có

`npm audit --omit=dev` hiện ghi nhận 7 advisory production: 4 high, 3 moderate,
0 critical. Chuỗi Firebase → Firestore → `@grpc/grpc-js` có advisory high về
xử lý certificate trong cấu hình server cụ thể; Expo → `@expo/fingerprint` →
`minimatch` có advisory moderate về glob-amplification DoS. Firebase Auth đã
được import, nhưng Firestore vẫn chưa được import trong application flow; các
advisory này vẫn cần đánh giá lại trước khi bật Firestore.

Không dùng `npm audit fix --force`: npm đề xuất hạ Expo xuống SDK 52 và Firebase
xuống 9.14, không tương thích với Expo SDK 58 hiện tại.

## Đầu vào cho Migration 2.3

Trước Firestore CRUD, thiết kế repository, deploy Rules có kiểm soát, App
Check/Rules strategy, schema profile/role và emulator tests phải được phê duyệt.

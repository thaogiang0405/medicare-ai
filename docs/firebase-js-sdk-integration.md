# MediCare AI — Firebase JavaScript SDK Integration (Migration 2.1–2.3)

## Phạm vi

Migration 2.1 kết nối Firebase JavaScript SDK modular với Firebase Web App
**MediCare AI Expo** trong project `medicare-ai-cf804`. Migration 2.2 bổ sung
Firebase Authentication Email/Password và React Native persistence. Firestore
User Profile giới hạn được thêm ở Migration 2.3: chỉ `/users/{auth.uid}` được
đọc/tạo/cập nhật qua repository, với UID lấy từ Firebase Auth. Rules M2.3 cho
surface profile này đã được deploy; Firestore CRUD cho thuốc/lịch, Admin SDK,
Cloud Functions, FCM và dữ liệu sức khỏe thật vẫn chưa được triển khai.

Các màn hình Splash, Onboarding, Đăng nhập, Đăng ký, chọn vai trò, Elderly Home
và Caregiver Dashboard tiếp tục dùng mock repositories cho dữ liệu thuốc/lịch.
UI không import Firebase SDK trực tiếp.

Cloud Firestore Native database `(default)` tại `asia-east1` đã hoạt động trong
production và Rules M2.3 đã được release chỉ cho owner profile. Profile vẫn là
feature opt-in trong `.env` local: cờ mặc định `false`, không có fallback
profile/role mock, và cờ không phải authorization.

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
   EXPO_PUBLIC_FIRESTORE_USER_PROFILES_ENABLED=false
   ```

   Có thể kiểm tra lại bằng Firebase CLI đã đăng nhập, không tạo app mới:

   ```powershell
   firebase apps:list --project medicare-ai-cf804
   firebase apps:sdkconfig WEB <WEB_APP_ID> --project medicare-ai-cf804
   ```

Sáu biến đầu là bắt buộc. `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` là tùy chọn vì
Analytics không thuộc Migration 2.1. Giữ
`EXPO_PUBLIC_FIRESTORE_USER_PROFILES_ENABLED=false` trong template; chỉ owner
mới đặt `true` trong `.env` local bị Git ignore cho một đợt profile test đã được
phê duyệt. Đó là cờ public, không phải secret hay cơ chế authorization.

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
và không lưu password/token trong Zustand. `firestore-boundary.ts` trả một
Firestore singleton qua `getFirestore(app)`; repository profile là ranh giới
duy nhất gọi `getDoc`, `runTransaction` và `updateDoc`. Firestore persistence
không được bật trong React Native/Expo; không hứa hẹn profile offline sau khi
khởi động lại app.

`runTransaction` chỉ tạo `/users/{auth.uid}` khi document chưa tồn tại và đọc
lại dữ liệu đã lưu. Nếu hai thao tác tạo role đồng thời, document tồn tại được
giữ nguyên thay vì đổi role. `serverTimestamp()` tạo `createdAt`/`updatedAt`;
UI không truyền UID hay gọi Firebase SDK trực tiếp. Role đã lưu chỉ quyết định
route UI, không cấp quyền đọc thuốc, lịch hay hồ sơ của người khác.

Xem [Firebase Authentication — Migration 2.2](firebase-authentication.md) để
bật Email/Password provider, password policy, email enumeration protection và
kiểm thử Expo Go trên iPhone. Xem [Firestore User Profiles — Migration
2.3](firestore-user-profiles.md) cho schema, Rules, emulator và quy trình
owner-controlled deployment.

## Bảo mật

Firebase Web config và API key client là định danh công khai dành cho ứng dụng
client, không phải service account. Tuy vậy, Expo nhúng toàn bộ biến
`EXPO_PUBLIC_*` vào bundle; không đưa password, token, service account JSON,
private key hoặc bất kỳ server credential nào vào `.env` hay source code.

`.env` bị ignore. Chỉ `.env.example` với placeholder/default an toàn được
version-control. Không dùng `lib/firebase_options.dart` hoặc
`android/app/google-services.json` của Flutter cho TypeScript. Rules M2.3 của
Firestore profile đã deploy; Storage Rules không được deploy trong Migration
2.3 và không có Firebase Admin SDK trong Expo app. `EXPO_PUBLIC_*` luôn có thể
xuất hiện trong client bundle;
chỉ Firebase client identifiers và cờ public mới được đặt ở đó.

## Kiểm thử

```powershell
npx expo-doctor@latest
npx expo lint
npx tsc --noEmit
npm test
npm run test:rules
npx expo export --platform ios
npx expo start --clear
```

Để kiểm thử thực tế trên iPhone, mở Expo Go SDK 58, bảo đảm iPhone và Windows
cùng Wi-Fi, quét QR từ `npx expo start --clear`, và thực hiện full reload. Nếu
Firebase config không hợp lệ, màn hình lỗi phát triển phải hiện ra. Nếu màn
hình Splash rồi luồng login/đăng ký xuất hiện bình thường, Firebase Core đã
khởi tạo trong runtime Expo Go. Để xác minh Auth/profile thật, làm theo checklist
trong [`firebase-authentication.md`](firebase-authentication.md) và
[`firestore-user-profiles.md`](firestore-user-profiles.md). Chủ dự án đã cho
biết đã thực hiện iPhone profile testing, nhưng case pass/fail cụ thể không được
ghi nhận ở đây. Nếu LAN bị chặn, dùng `npx expo start --tunnel`.
`npm run test:rules` dùng Firestore Emulator với UID tổng hợp; nó không ghi dữ
liệu production hoặc deploy Rules.

## Advisory hiện có

Lần audit gần nhất ghi nhận **37 high, 2 moderate, 0 critical** dependency
instances. Chúng quy về advisory high cho `@grpc/grpc-js` (qua Firebase
Firestore) và `picomatch` (Expo/Metro/Jest tooling), cùng advisory moderate cho
`minimatch` qua `@expo/fingerprint`. Firestore React Native entrypoint không
tham chiếu `@grpc/grpc-js`, nhưng dependency vẫn phải được theo dõi. Audit là
dependency tree, không phải bằng chứng bundle/runtime exploit.

Không dùng `npm audit fix --force`: npm chỉ đề xuất các thay thế không tương
thích với dependency set hiện tại, gồm Expo `52.0.49`, React Native `0.83.10`
và Firebase `9.14.0`. Không downgrade Expo SDK 58 hoặc thay package lock chỉ để
ép audit về 0.

## Trạng thái và bước tiếp theo

Schema profile, repository, emulator tests và Rules production owner-profile đã
có. Baseline deny-all, deployment record và rollback process được lưu tại
[`firestore-production-deny-all-baseline.md`](firestore-production-deny-all-baseline.md).
Medication/schedule CRUD, caregiver links, health-data authorization, App Check
enforcement, Functions, FCM và dữ liệu sức khỏe thật vẫn là phạm vi sau
Migration 2.3.

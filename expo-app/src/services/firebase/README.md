# Firebase boundary (Migration 2.2–2.3)

MediCare AI Expo dùng Firebase JavaScript SDK modular. Project được chọn qua
cấu hình `.env` cục bộ đã bị Git ignore; Family Care QA chỉ dùng project
`medicare-ai-staging`, không dùng Production.

## Vai trò các file

- `firebase-config.ts`: đọc trực tiếp các biến `EXPO_PUBLIC_FIREBASE_*`, kiểm
  tra năm giá trị bắt buộc và ném lỗi rõ ràng nếu cấu hình thiếu. `storageBucket`
  là tùy chọn vì app hiện không dùng Firebase Storage. Không có giá trị dự phòng
  hoặc project giả.
- `firebase-app.ts`: khởi tạo `firebase/app` bằng `getApps()` / `getApp()` /
  `initializeApp()` để Fast Refresh không tạo default app trùng lặp.
- `firebase-auth-boundary.ts`: khởi tạo Firebase Auth một lần với
  `initializeAuth()` và React Native AsyncStorage persistence. Khi Fast Refresh
  báo instance đã tồn tại, nó mới dùng `getAuth()` để lấy lại instance đó.
- `firestore-boundary.ts`: trả Firestore singleton từ Firebase App đã cấu hình.
  Không bật Firestore persistence trong React Native/Expo.
- `firestore-profile-feature.ts`: đọc cờ public
  `EXPO_PUBLIC_FIRESTORE_USER_PROFILES_ENABLED`. Template mặc định tắt; owner
  chỉ bật cờ trong `.env` local đã được phê duyệt để kiểm thử profile. Cờ không
  phải authorization.
- `firestore-medication-feature.ts` và `firestore-schedule-feature.ts`: giữ
  Medication M3.2 và Schedule M3.3 ở mock mode mặc định. Cả hai chỉ chọn
  repository khi cờ public trong `.env` local là `true`; Rules vẫn là lớp
  authorization duy nhất.
- `features/profile/data/firestore-user-profile-repository.ts`: ranh giới duy
  nhất dùng Firestore cho `/users/{auth.uid}`. UID luôn lấy từ Auth,
  `runTransaction` chỉ tạo profile khi chưa có, và client không có API đổi role.
- `FirebaseInitializationGate`: khởi tạo Firebase Core trước khi route được
  hiển thị. Nếu lỗi, nó hiển thị màn hình lỗi phát triển thay vì âm thầm tiếp
  tục với Firebase chưa được xác minh.

## Giới hạn bảo mật và phạm vi

- `firebase_options.dart` và `google-services.json` của Flutter **không** được
  dùng trong TypeScript.
- `EXPO_PUBLIC_*` được Expo nhúng vào client bundle, vì vậy chỉ chứa Firebase
  Web client identifiers. Không bao giờ đặt service account, private key,
  password hoặc token vào đó.
- `FirebaseAuthRepository` gọi Firebase Auth ở data layer; UI và Zustand chỉ
  phụ thuộc AuthRepository/AppUser, không gọi Firebase SDK trực tiếp.
- Firebase Auth Email/Password (M2.2), owner Profile (M2.3) và owner Medication
  CRUD (M3.2) đã có. M3.3 thêm Schedule repository feature-gated; nó không tạo
  DoseEvent, notification, trusted `nextOccurrenceAt`, Analytics, Admin SDK hay
  Cloud Functions.
- Cloud Firestore production `(default)` tại `asia-east1` đang dùng Rules M3.2.
  Rules Schedule M3.3 vẫn là source local, chưa được deploy. Storage Rules không
  được deploy. Chạy Rules Emulator bằng `npm run test:rules` trong `expo-app/`;
  schema M3.3 ở
  [`docs/medication-schedules-m3.3.md`](../../../../docs/medication-schedules-m3.3.md).

Hướng dẫn cấu hình và kiểm thử chi tiết ở
[`docs/firebase-js-sdk-integration.md`](../../../../docs/firebase-js-sdk-integration.md)
và [`docs/firebase-authentication.md`](../../../../docs/firebase-authentication.md).

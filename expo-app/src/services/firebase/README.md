# Firebase boundary (Migration 2.2–2.3)

MediCare AI Expo dùng Firebase JavaScript SDK modular với Firebase Web App chính
thức trong project `medicare-ai-cf804`. Cấu hình client nằm trong `.env` cục bộ
đã bị Git ignore; `.env.example` chỉ giữ tên biến, không giữ giá trị.

## Vai trò các file

- `firebase-config.ts`: đọc trực tiếp các biến `EXPO_PUBLIC_FIREBASE_*`, kiểm
  tra sáu giá trị bắt buộc và ném lỗi rõ ràng nếu cấu hình thiếu. Không có giá
  trị dự phòng hoặc project giả.
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
- Firebase Auth Email/Password đã có trong Migration 2.2. M2.3 bổ sung User
  Profile feature-gated và deploy Rules owner-profile; profile role không cấp
  quyền đọc health data. Firestore CRUD cho medication/schedule, Analytics,
  Admin SDK và Cloud Functions vẫn chưa có.
- Cloud Firestore production `(default)` tại `asia-east1` đang dùng Rules M2.3.
  Storage Rules không được deploy. Chạy Rules Emulator bằng `npm run test:rules`
  trong `expo-app/`; tài liệu schema/deployment/rollback là
  [`docs/firestore-user-profiles.md`](../../../../docs/firestore-user-profiles.md).

Hướng dẫn cấu hình và kiểm thử chi tiết ở
[`docs/firebase-js-sdk-integration.md`](../../../../docs/firebase-js-sdk-integration.md)
và [`docs/firebase-authentication.md`](../../../../docs/firebase-authentication.md).

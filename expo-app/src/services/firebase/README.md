# Firebase boundary (Migration 2.2)

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
- `firestore-boundary.ts`: vẫn chỉ là điểm composition cho milestone sau; không
  import Firestore và không đọc/ghi dữ liệu.
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
- Firebase Auth Email/Password đã có trong Migration 2.2. Firestore CRUD,
  Analytics, Security Rules deployment, Admin SDK và Cloud Functions vẫn chưa
  có.

Hướng dẫn cấu hình và kiểm thử chi tiết ở
[`docs/firebase-js-sdk-integration.md`](../../../../docs/firebase-js-sdk-integration.md)
và [`docs/firebase-authentication.md`](../../../../docs/firebase-authentication.md).

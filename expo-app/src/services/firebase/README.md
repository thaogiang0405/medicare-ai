# Firebase boundary (Migration 2.1)

MediCare AI Expo dùng Firebase JavaScript SDK modular với Firebase Web App chính
thức trong project `medicare-ai-cf804`. Cấu hình client nằm trong `.env` cục bộ
đã bị Git ignore; `.env.example` chỉ giữ tên biến, không giữ giá trị.

## Vai trò các file

- `firebase-config.ts`: đọc trực tiếp các biến `EXPO_PUBLIC_FIREBASE_*`, kiểm
  tra sáu giá trị bắt buộc và ném lỗi rõ ràng nếu cấu hình thiếu. Không có giá
  trị dự phòng hoặc project giả.
- `firebase-app.ts`: khởi tạo `firebase/app` bằng `getApps()` / `getApp()` /
  `initializeApp()` để Fast Refresh không tạo default app trùng lặp.
- `firebase-auth-boundary.ts` và `firestore-boundary.ts`: điểm composition cho
  Migration 2.2. Chúng chỉ trả về `FirebaseApp`; không import Auth/Firestore,
  không cấu hình persistence và không đọc/ghi dữ liệu.
- `FirebaseInitializationGate`: khởi tạo Firebase Core trước khi route được
  hiển thị. Nếu lỗi, nó hiển thị màn hình lỗi phát triển thay vì âm thầm tiếp
  tục với Firebase chưa được xác minh.

## Giới hạn bảo mật và phạm vi

- `firebase_options.dart` và `google-services.json` của Flutter **không** được
  dùng trong TypeScript.
- `EXPO_PUBLIC_*` được Expo nhúng vào client bundle, vì vậy chỉ chứa Firebase
  Web client identifiers. Không bao giờ đặt service account, private key,
  password hoặc token vào đó.
- Repository mock, Zustand stores và UI vẫn không gọi Firebase SDK trực tiếp.
- Chưa có Firebase Authentication, Firestore CRUD, Analytics, Security Rules
  deployment, Admin SDK hoặc Cloud Functions trong Migration 2.1.

Hướng dẫn cấu hình và kiểm thử chi tiết ở
[`docs/firebase-js-sdk-integration.md`](../../../../docs/firebase-js-sdk-integration.md).

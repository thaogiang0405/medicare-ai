# Firebase boundary (Migration 1)

MediCare AI sẽ tiếp tục dùng Firebase Project `medicare-ai-cf804`, nhưng ứng dụng Expo chưa được cấu hình Firebase trong Migration 1.

- `firebase_options.dart` của Flutter **không** được dùng trong TypeScript.
- Firebase JavaScript SDK yêu cầu cấu hình chính thức của một Firebase **Web App** trong cùng project. Project ID đơn lẻ không đủ để khởi tạo SDK.
- Chưa có Web App configuration, API key client, service account, Admin SDK, token, hay private key nào trong thư mục này.
- Khi chủ dự án xác nhận/đăng ký Firebase Web App, cấu hình client hợp lệ sẽ được thêm theo hướng dẫn Firebase; không dùng cấu hình giả.
- Expo Go chạy trong native container của Expo. Trước khi tạo EAS/development build, nhóm cần quyết định riêng Android/iOS bundle identifiers và Firebase client apps; không tự tái sử dụng hoặc thay đổi applicationId Flutter ở Migration 1.
- Authentication thật, Firestore CRUD, Security Rules deployment và đồng bộ dữ liệu sức khỏe đều nằm ngoài Migration 1.

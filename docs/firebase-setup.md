# Firebase Setup — Phase 2.1

## Phạm vi hoàn thành

MediCare AI đã được liên kết với Firebase Project `medicare-ai-cf804` trên nền tảng Android duy nhất.

| Hạng mục | Giá trị |
|---|---|
| Firebase Project ID | `medicare-ai-cf804` |
| Android package name | `com.medicareai.medicare_ai` |
| FlutterFire CLI | 1.5.0 khi cấu hình |
| Platform được cấu hình | Android |

FlutterFire đã tạo một Android Firebase app đúng package trên; không có app Android trùng package trước đó.

## File do FlutterFire quản lý

| File | Vai trò |
|---|---|
| `lib/firebase_options.dart` | `DefaultFirebaseOptions.currentPlatform` được dùng khi khởi tạo `firebase_core`. |
| `android/app/google-services.json` | Metadata Android client cho Firebase/Google Services Gradle plugin. |
| `android/settings.gradle.kts` | Khai báo Google Services Gradle plugin. |
| `android/app/build.gradle.kts` | Áp dụng Google Services plugin cho app Android. |
| `firebase.json` | Giữ rules/indexes và metadata FlutterFire của Android app. |

Các file client configuration nêu trên được version-control. Chúng có project/app identifier và API key dùng ở client, không phải service account, private key hay server credential. Bảo mật thực tế dựa vào Firebase Authentication, Security Rules, App Check và API restriction phù hợp; đừng đưa bất kỳ service account JSON hoặc private key nào vào app/repository.

## Dependencies đã sẵn sàng

```yaml
firebase_core: ^5.2.0
firebase_auth: ^7.1.0
cloud_firestore: ^7.2.0
```

Ở Phase 2.1, chỉ `firebase_core` được gọi trong bootstrap. `firebase_auth` và `cloud_firestore` được cài sẵn cho Phase 2.2, nhưng chưa có repository implementation, login, profile hay CRUD Firestore nào được triển khai.

## Khởi tạo ứng dụng

`bootstrap()` thực hiện theo thứ tự:

1. `WidgetsFlutterBinding.ensureInitialized()`.
2. `Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform)`.
3. Chỉ khi thành công mới chạy `ProviderScope` và `MediCareApp`.
4. Nếu lỗi, ghi lỗi vào Flutter error reporting và hiển thị màn hình development-safe. Không tự chạy mock Firebase hoặc che giấu lỗi cấu hình.

## Cài đặt trên máy thành viên khác

1. Clone repository, bao gồm `lib/firebase_options.dart` và `android/app/google-services.json`.
2. Cài Flutter SDK tương thích với Dart `^3.13.4` và Android SDK.
3. Chạy:

   ```powershell
   flutter pub get
   flutter analyze
   flutter test
   flutter run
   ```

4. Không cần tạo Firebase Project mới để chạy Android app đã cấu hình.
5. Nếu cần thêm platform hoặc làm mới client config, cài Firebase CLI + FlutterFire CLI, đăng nhập đúng Firebase account rồi chạy:

   ```powershell
   flutterfire configure --project=medicare-ai-cf804 --platforms=android --android-package-name=com.medicareai.medicare_ai
   ```

Không đổi package name hoặc Project ID khi chạy lại configure nếu chưa có quyết định kiến trúc rõ ràng.

## Emulator strategy (chưa kích hoạt)

Phase 2.1 không deploy Firestore/Storage Rules và không khởi động Emulator Suite. Khi bắt đầu Auth/Firestore tests, nhóm cần thống nhất thay đổi `firebase.json`, sau đó thêm emulator config bằng Firebase CLI và chạy:

```powershell
firebase emulators:start --only auth,firestore
```

App sẽ cần một environment flag/service riêng để kết nối emulator; không hardcode localhost hoặc bypass Security Rules trong production path.

## Việc chưa triển khai

- Firebase Authentication UI hoặc `FirebaseAuthRepository`.
- User profile, Firestore CRUD hoặc authorization enforcement.
- Firebase Storage, Cloud Messaging, Analytics, Crashlytics hoặc App Check.
- Deploy Firestore/Storage Security Rules.
- OCR, TTS, medication/scheduling data thật hoặc bất kỳ chức năng Phase 2.2+ nào.

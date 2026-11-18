# MediCare AI

Ứng dụng Flutter Android hỗ trợ người cao tuổi quản lý lịch thuốc và cho phép người chăm sóc theo dõi dữ liệu **sau khi được cấp quyền rõ ràng**.

> MediCare AI hỗ trợ ghi nhận thông tin, không thay thế bác sĩ. Ứng dụng không tư vấn liều, không tự suy luận dữ liệu thiếu từ đơn thuốc, và trạng thái “Đã uống” chỉ là tự báo cáo.

## Migration sang React Native + Expo

Nền Flutter ở thư mục gốc được giữ nguyên làm baseline Phase 2.1. Migration 1 tạo một ứng dụng React Native + Expo SDK 58 độc lập trong [`expo-app/`](expo-app/), dùng TypeScript strict, Expo Router, Zustand và mock repository in-memory. Không có thay đổi Firebase Authentication hoặc Firestore CRUD trong phần migration này.

Migration 2.2 đã kết nối Firebase JavaScript SDK modular trong Expo từ Firebase
Web App chính thức của project `medicare-ai-cf804`. Cấu hình được đọc từ
`expo-app/.env` bị Git ignore qua các biến `EXPO_PUBLIC_FIREBASE_*`; không dùng
lại `firebase_options.dart` của Flutter cho TypeScript. Firebase Authentication
Email/Password có `FirebaseAuthRepository`, observer khôi phục phiên và
React Native AsyncStorage persistence chính thức. Khi Migration 2.2 hoàn thành,
chưa có Firestore CRUD; Migration 2.3 chỉ thêm profile giới hạn được mô tả bên
dưới. Không có service account hay server secret trong Expo app.

Luồng Firebase Authentication của Expo đã được người kiểm thử xác nhận chạy
trên iPhone thật bằng Expo Go SDK 58. Xác minh này không bao gồm Firestore,
phân quyền backend hoặc dữ liệu sức khỏe thật.

Migration 2.3 triển khai Firestore User Profile giới hạn tại
`/users/{auth.uid}`: repository chỉ dùng UID Firebase Auth, route được quyết
định bởi role đã lưu và Rules Emulator kiểm tra schema/ownership. Firestore
database `(default)` tại `asia-east1` đang dùng Rules M2.3 đã deploy; bản
deny-all trước deploy được lưu làm baseline rollback tại
[`docs/firestore-production-deny-all-baseline.md`](docs/firestore-production-deny-all-baseline.md).
Template `EXPO_PUBLIC_FIRESTORE_USER_PROFILES_ENABLED` vẫn mặc định `false`;
chủ project chỉ bật nó trong `.env` local đã ignore khi kiểm thử có chủ đích.
Cờ public này không phải lớp phân quyền và app không có fallback gán role mock.
Role chỉ là điều hướng UI, không phải quyền đọc dữ liệu sức khỏe.

Chủ project cho biết đã kiểm thử User Profile trên iPhone bằng Expo Go SDK 58,
nhưng kết quả theo từng trường hợp chưa được ghi nhận trong repository; tài liệu
không coi role onboarding, persistence hoặc đổi tài khoản là đã pass nếu không
có bằng chứng tương ứng.

Xem [kế hoạch Migration](docs/migration-to-expo.md), [hướng dẫn chạy Expo](expo-app/README.md), [Firebase JavaScript SDK Integration](docs/firebase-js-sdk-integration.md), [Firebase Authentication — Migration 2.2](docs/firebase-authentication.md) và [Firestore User Profiles — Migration 2.3](docs/firestore-user-profiles.md). Flutter vẫn là mã tham chiếu cho đến khi migration được kiểm thử thiết bị và được phê duyệt riêng.

## Trạng thái hiện tại — Phase 2.1: Firebase Setup

Đã có nền Flutter Android, kiến trúc feature-first, điều hướng GoRouter, state Riverpod, theme tiếng Việt dễ tiếp cận và luồng dữ liệu giả lập có thể thao tác:

- Splash, onboarding, đăng nhập/đăng ký trình diễn và chọn vai trò.
- Repository contract cùng `Mock*Repository` in-memory cho auth, thuốc và dose event; UI không phụ thuộc Firebase trực tiếp.
- Trang chủ cho Người cao tuổi và Người chăm sóc.
- Danh sách thuốc, thêm thuốc, chi tiết/ngừng thuốc trong bộ nhớ.
- Lịch thuốc hôm nay; nút `Đã uống`, `Bỏ qua`, `Nhắc lại` cập nhật trạng thái giả lập.
- Luồng kiểm tra đơn thuốc có bước xác nhận bắt buộc trước khi tạo thuốc giả lập.
- Các màn hình nền tảng cho lịch sử, liên kết gia đình, theo dõi, hồ sơ và cài đặt.
- Thiết kế Firestore, Security Rules, Storage Rules và indexes ở mức sẵn sàng tích hợp Firebase.
- Firebase Android đã được liên kết chính thức với project `medicare-ai-cf804` thông qua FlutterFire CLI.
- `firebase_core`, `firebase_auth` và `cloud_firestore` đã được cài đặt; ứng dụng chỉ khởi tạo Firebase, chưa dùng chúng để xác thực hoặc đọc/ghi dữ liệu.

Firebase Authentication, Firestore CRUD, camera/ML Kit OCR, local notification, TTS và FCM **chưa được triển khai**. Không có dữ liệu y tế thật, service account hoặc khóa bí mật phía server trong repository.

## Chạy dự án

Yêu cầu: Flutter 3.47.5 hoặc SDK tương thích Dart `^3.13.4`, Android SDK và một emulator/thiết bị Android.

```powershell
flutter pub get
flutter analyze
flutter test
flutter run
```

Package Android hiện tại là `com.medicareai.medicare_ai`. Đổi package/bộ ký ứng dụng trước khi phát hành.

## Cấu trúc chính

```text
lib/
  app/                 # App shell, GoRouter, theme và token trợ năng
  core/                # Widget và utilities dùng chung
  features/
    auth/
    elderly_home/
    medication/
    schedule/
    dose_event/
    prescription_scanner/
    family_connection/
    caregiver_monitoring/
    profile/
    settings/
docs/                  # Quyết định kiến trúc và mô hình dữ liệu
firestore.rules         # Rules M2.3 đã deploy cho Firestore (default)
storage.rules           # Quy tắc truy cập Firebase Storage mẫu
firestore.indexes.json  # Composite indexes dự kiến
```

Mỗi feature sẽ phát triển theo hướng `data → domain → presentation`: UI không gọi Firebase/ML Kit/notification trực tiếp. Phase 1 dùng `Mock*Repository` trong data layer và `NotifierProvider` ở presentation để luồng UI có thể kiểm thử trước khi cấu hình backend.

## Tài liệu thiết kế

- [Kiến trúc, yêu cầu và roadmap](docs/architecture.md)
- [Mô hình Firestore và đồng bộ](docs/firestore-data-model.md)
- [Hướng dẫn an toàn Firebase Rules](docs/firebase-security.md)
- [Phạm vi Phase 1](docs/phase-1-foundation.md)
- [Firebase Setup — Phase 2.1](docs/firebase-setup.md)
- [Migration sang React Native + Expo — Migration 1](docs/migration-to-expo.md)
- [Firestore User Profiles & Role Security — Migration 2.3](docs/firestore-user-profiles.md)

## Firebase Setup — Phase 2.1

Firebase Project hiện dùng: `medicare-ai-cf804`.

Android package: `com.medicareai.medicare_ai`.

Firebase initialization chưa được xác minh bằng lần chạy thực tế trên Android device hoặc emulator. Hiện tại chỉ đã kiểm tra dependency resolution, static analysis và widget test; cần chạy `flutter run` trên Android trước khi coi native integration đã được kiểm chứng trên thiết bị.

FlutterFire đã tạo và cập nhật các file client configuration sau:

- `lib/firebase_options.dart`
- `android/app/google-services.json`
- Android Google Services Gradle plugin và metadata `flutter` trong `firebase.json`

Ba package nền tảng hiện có:

- `firebase_core`
- `firebase_auth`
- `cloud_firestore`

Thành viên mới chỉ cần chạy:

```powershell
flutter pub get
flutter analyze
flutter test
flutter run
```

Không tự viết `firebase_options.dart`. Khi cần thêm platform Firebase mới, chạy lại:

```powershell
flutterfire configure --project=medicare-ai-cf804 --platforms=android --android-package-name=com.medicareai.medicare_ai
```

`firebase_options.dart` và `google-services.json` là client configuration được version-control để nhóm dùng cùng Android app. Không commit `.env`, service account JSON, private key, keystore hoặc `key.properties`.

### Emulator cho giai đoạn kiểm thử

Khi bắt đầu kiểm thử Auth/Firestore, cài Firebase Emulator Suite và thêm emulator configuration có chủ đích. Chưa chạy hoặc deploy gì ở Phase 2.1.

```powershell
# Chỉ chạy khi nhóm đã thống nhất thay đổi firebase.json.
firebase init emulators
firebase emulators:start --only auth,firestore
```

Xem [hướng dẫn Firebase Setup chi tiết](docs/firebase-setup.md) trước khi thêm service hoặc deploy Security Rules.

## Milestone đề xuất

1. **Foundation** — hoàn thành skeleton, mock flow, docs và security design.
2. **Authentication & Profile** — Firebase Auth, profile, role redirect và Emulator tests.
3. **Medication & Scheduling** — CRUD Firestore, schedule versioning, dose events và lịch sử bất biến.
4. **Reminders** — local notification, exact-alarm/notification permission, dedupe và kiểm thử máy thật.
5. **OCR & TTS** — camera/ảnh, ML Kit, editable review bắt buộc, tiếng Việt TTS.
6. **Family Care** — invite/approval/revoke qua Cloud Functions, dashboard caregiver, FCM overdue.
7. **Hardening** — tests, offline UX, accessibility audit, demo data và Android release signing.

## An toàn dữ liệu

- Không ghi đơn thuốc, OCR raw text, token hoặc thông tin nhạy cảm vào log/analytics.
- Tất cả server timestamp dùng Firestore `Timestamp` (UTC); UI chuyển sang timezone hồ sơ.
- Lịch sử dose event dùng ID xác định để chống trùng; sửa lịch chỉ có hiệu lực cho lần tương lai.
- Người chăm sóc mất quyền không được đọc dữ liệu mới. Dữ liệu đã xem trước đó không thể bị “thu hồi” khỏi bộ nhớ con người/thiết bị, vì vậy điều này phải được nêu rõ trong chính sách quyền riêng tư.

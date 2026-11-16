# MediCare AI

Ứng dụng Flutter Android hỗ trợ người cao tuổi quản lý lịch thuốc và cho phép người chăm sóc theo dõi dữ liệu **sau khi được cấp quyền rõ ràng**.

> MediCare AI hỗ trợ ghi nhận thông tin, không thay thế bác sĩ. Ứng dụng không tư vấn liều, không tự suy luận dữ liệu thiếu từ đơn thuốc, và trạng thái “Đã uống” chỉ là tự báo cáo.

## Trạng thái hiện tại — Phase 1: Foundation

Đã có nền Flutter Android, kiến trúc feature-first, điều hướng GoRouter, state Riverpod, theme tiếng Việt dễ tiếp cận và luồng dữ liệu giả lập có thể thao tác:

- Splash, onboarding, đăng nhập/đăng ký trình diễn và chọn vai trò.
- Repository contract cùng `Mock*Repository` in-memory cho auth, thuốc và dose event; UI không phụ thuộc Firebase trực tiếp.
- Trang chủ cho Người cao tuổi và Người chăm sóc.
- Danh sách thuốc, thêm thuốc, chi tiết/ngừng thuốc trong bộ nhớ.
- Lịch thuốc hôm nay; nút `Đã uống`, `Bỏ qua`, `Nhắc lại` cập nhật trạng thái giả lập.
- Luồng kiểm tra đơn thuốc có bước xác nhận bắt buộc trước khi tạo thuốc giả lập.
- Các màn hình nền tảng cho lịch sử, liên kết gia đình, theo dõi, hồ sơ và cài đặt.
- Thiết kế Firestore, Security Rules, Storage Rules và indexes ở mức sẵn sàng tích hợp Firebase.

Firebase Authentication, Firestore, camera/ML Kit OCR, local notification, TTS và FCM **chưa được kết nối** vì chưa có cấu hình Firebase của dự án. Không có dữ liệu y tế thật hoặc khóa bí mật trong repository.

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
firestore.rules         # Quy tắc truy cập Firestore mẫu
storage.rules           # Quy tắc truy cập Firebase Storage mẫu
firestore.indexes.json  # Composite indexes dự kiến
```

Mỗi feature sẽ phát triển theo hướng `data → domain → presentation`: UI không gọi Firebase/ML Kit/notification trực tiếp. Phase 1 dùng `Mock*Repository` trong data layer và `NotifierProvider` ở presentation để luồng UI có thể kiểm thử trước khi cấu hình backend.

## Tài liệu thiết kế

- [Kiến trúc, yêu cầu và roadmap](docs/architecture.md)
- [Mô hình Firestore và đồng bộ](docs/firestore-data-model.md)
- [Hướng dẫn an toàn Firebase Rules](docs/firebase-security.md)
- [Phạm vi Phase 1](docs/phase-1-foundation.md)

## Chuẩn bị Firebase cho Phase 2+

1. Tạo Firebase project riêng cho môi trường development; không tái sử dụng dữ liệu bệnh nhân thật.
2. Chạy `flutterfire configure` để sinh `lib/firebase_options.dart`. File này không được viết tay và không chứa secret phía server.
3. Cài và cấu hình Firebase Auth, Cloud Firestore, Storage, FCM và App Check.
4. Triển khai rules/indexes sau khi review theo nghiệp vụ thực tế:

   ```powershell
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

5. Kiểm thử rules bằng Firebase Emulator trước khi mở dữ liệu thật.
6. Chỉ thêm ML Kit, local notifications, TTS và quyền Android khi từng tính năng tương ứng được triển khai và kiểm thử trên thiết bị.

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

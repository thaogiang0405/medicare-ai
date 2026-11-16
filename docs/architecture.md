# Kiến trúc MediCare AI

## 1. Bài toán

MediCare AI giúp người cao tuổi xem lịch thuốc, nhận lời nhắc, tự báo cáo phản hồi và kiểm tra lại thông tin đơn thuốc; đồng thời giúp người chăm sóc theo dõi **chỉ các hồ sơ đã đồng ý chia sẻ**. Ứng dụng không đưa ra chẩn đoán, không thay thế bác sĩ và không suy diễn liều/thời điểm khi đơn thuốc không rõ.

Hai vai trò:

| Vai trò | Khả năng MVP |
|---|---|
| Người cao tuổi | Xem lịch hôm nay, tự báo đã uống/bỏ qua/nhắc lại, xem thuốc/lịch sử, quét rồi xác nhận đơn, chấp thuận hoặc thu hồi caregiver. |
| Người chăm sóc | Quản lý hồ sơ đã được chấp thuận, xem thuốc/lịch trong đúng scope, theo dõi trạng thái tự báo và nhận cảnh báo quá hạn. |

`Chưa phản hồi` không có nghĩa `chưa uống`. `Đã uống` chỉ là trạng thái do người dùng tự báo cáo.

## 2. Functional requirements MVP

1. Authentication, session và profile theo role.
2. Family-care invitation → elderly approval/rejection → revoke lifecycle.
3. Medication CRUD: tên, hàm lượng text, hướng dẫn theo đơn, ảnh, thời gian hiệu lực, soft stop và audit.
4. Schedule: giờ/ngày, timezone, chỉnh sửa không phá lịch sử, chống nhắc trùng.
5. Dose event: pending/taken/skipped/snoozed/unanswered cùng thời điểm, actor và nguồn phản hồi.
6. OCR: ảnh/camera → text candidate → biểu mẫu chỉnh sửa → user confirmation bắt buộc → mới tạo thuốc/lịch.
7. Monitoring: caregiver nhìn dashboard được cấp quyền; overdue notification dùng semantics “chưa phản hồi”.

## 3. Non-functional requirements

- Android-first, Vietnamese-first, thao tác tối thiểu, chữ lớn, target chạm ≥48dp (nền tảng hiện dùng 56dp), tương phản cao, icon + text và feedback tải/lỗi/thành công.
- UI không coi role hoặc route guard là bảo mật; Firestore/Storage Rules là enforcement bắt buộc.
- Không log raw prescription/OCR, FCM token hay dữ liệu sức khỏe nhạy cảm.
- Timestamp server là Firestore `Timestamp` UTC; lịch nghiệp vụ giữ IANA timezone và local date/time rõ ràng.
- Viết idempotent với event/notification deterministic ID và Firestore transaction.
- Offline cache là best-effort; Android background delivery/notification phải được kiểm thử thiết bị thật.
- Interfaces của OCR, clock, notification, TTS và repository phải mock được trong unit/widget test.

## 4. Kiến trúc đề xuất

```text
Presentation
  Flutter pages/widgets + GoRouter + Riverpod controller
        ↓
Domain
  entities + repository contracts + validation/use cases
        ↓
Data
  Firestore/Storage/Auth DTO + repository implementations
        ↓
Infrastructure
  Firebase, ML Kit, flutter_local_notifications, TTS, clock
```

Với các feature đơn giản, giữ Clean Architecture “nhẹ”: không tạo use case rỗng chỉ để đủ tầng. UI không gọi Firebase, ML Kit hay notification plugin trực tiếp. `Demo*Controller` chỉ điều phối state; các `Mock*Repository` nằm trong data layer và triển khai domain contract. Khi có Firebase, thay implementation provider thay vì sửa page/widget.

### Công nghệ

- Flutter/Dart + Material 3.
- Riverpod để state/dependency injection; GoRouter để điều hướng và redirect theo session/role ở Phase 2.
- Firebase Auth, Firestore, Storage, FCM, App Check; Cloud Functions/Tasks cho invitation, audit, event expansion và notification server-trusted.
- Google ML Kit OCR, `flutter_tts`, speech-to-text nâng cao, `flutter_local_notifications` + timezone cho device reminder.

Không commit Firebase service credential hoặc server key. `firebase_options.dart` chỉ được sinh qua `flutterfire configure`.

## 5. Cấu trúc thư mục

```text
lib/
  main.dart, bootstrap.dart
  app/
    app.dart
    router/                 # route names, GoRouter
    theme/                  # color/type/touch tokens
  core/
    errors/
    services/               # future: notification, tts, ocr, clock
    utils/
    widgets/
  features/
    auth/
      data/ domain/ presentation/
    profile/
    family_connection/
    medication/
    schedule/
    dose_event/
    reminder/
    prescription_scanner/
    caregiver_monitoring/
    settings/
```

Mỗi feature mới đặt `data/`, `domain/`, `presentation/` khi có business/data logic. Không giữ thư mục trống chỉ để minh họa.

## 6. Dependency order

```text
Auth + profile
        ↓
ownership/rules ───────────────→ family link active
        ↓                                ↓
medication + schedule → dose events → local reminder → monitoring/FCM
        ↑
confirmed OCR review only
```

## 7. Screen map

### Common

Splash, onboarding, login, register, role selection, profile, settings.

### Elderly

Home (next dose first), today schedule, medication list/detail/add, medication history, reminder action, prescription camera + OCR review, family connection.

### Caregiver

Dashboard, linked elderly profile list/detail, medication/schedule management when scope allows, monitoring/notification detail, adherence report.

### Accessibility behavior

Home elderly surfaces in this order: next medication + action, scan prescription, medication list and contact caregiver. All status labels include words; color is secondary. Destructive/medical-sensitive operations require a clear confirmation in the implementation milestone.

## 8. Implementation plan

| Milestone | Outcome | Dependency |
|---|---|---|
| 1. Foundation | Current shell, navigation, mock flows, docs/rules design | None |
| 2. Auth & Profile | Firebase Auth, profile creation, role redirect, Auth emulator tests | Firebase project |
| 3. Medication & Schedule | Firestore CRUD, validation, schedule versioning/event expansion | Ownership rules |
| 4. Reminder | local notifications, Android permissions, response/dedupe | Dose events |
| 5. OCR & TTS | ML Kit image/camera, edit/confirm gate, Vietnamese TTS | Medication model |
| 6. Family Care | Callable invite/approval/revoke, dashboard and FCM | Rules + Cloud Functions |
| 7. Hardening | Emulator/integration tests, offline UX, accessibility + release build | All core modules |

## 9. Key assumptions

- First release target is Android; iOS is not a Phase 1 deliverable.
- Firebase project and production privacy policy are supplied by the project owner.
- All directions originate from a verified prescription/manual entry; MediCare AI never creates missing dosage instructions.
- Caregiver default scopes are limited (`profileRead`, `medicationsRead`, `schedulesRead`, `doseHistoryRead`). Write scopes are explicit opt-in.
- A missed/unanswered event is a workflow signal, not medical evidence.

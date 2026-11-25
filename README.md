# MediCare AI

MediCare AI hiện được phát triển và vận hành bằng **React Native + Expo SDK 58** trong thư mục [`expo-app/`](expo-app/). Đây là ứng dụng chính thức duy nhất của repository, dùng TypeScript strict, Expo Router, Zustand và Firebase JavaScript SDK modular.

> MediCare AI hỗ trợ ghi nhận thông tin, không thay thế bác sĩ. Ứng dụng không tư vấn liều, không tự suy luận dữ liệu thiếu từ đơn thuốc, và trạng thái “Đã uống” chỉ là tự báo cáo.

## Công nghệ và tính năng

- Firebase Authentication Email/Password với AsyncStorage persistence.
- Hồ sơ người dùng và phân quyền route dựa trên role đã lưu; role UI không thay thế Security Rules.
- Quản lý thuốc, lịch dùng thuốc, DoseEvent tự khai báo và lịch sử phân trang.
- Nhắc thuốc cục bộ theo UID/thiết bị; không có FCM hoặc server scheduler trong luồng hiện hành.
- Quét đơn thuốc review-first bằng Tesseract.js tiếng Việt + tiếng Anh chạy trên thiết bị; người dùng phải xem và xác nhận trước khi lưu.
- Family Care MVP: người sở hữu hồ sơ chủ động tạo lời mời, caregiver claim bằng UID và chỉ được đọc sau khi owner phê duyệt; owner có thể thu hồi quyền. Caregiver không được ghi sửa thuốc/lịch.

Các tích hợp Firestore và Family Care được kiểm soát bằng feature flags trong `.env`. Các flag trong `.env.example` mặc định tắt; public flag chỉ điều khiển routing/UI, không cấp quyền truy cập. Firestore Security Rules mới là lớp phân quyền thực tế.

## Firebase: môi trường và an toàn phát hành

| Môi trường | Project ID | Project Number | Phạm vi |
|---|---|---:|---|
| Production | `medicare-ai-cf804` | `354989416256` | Không dùng trong đợt QA Family Care này |
| Staging | `medicare-ai-staging` | `318128431668` | Môi trường duy nhất cho QA Family Care |

Để chạy Expo, sao chép `expo-app/.env.example` thành `expo-app/.env` và điền Web App config lấy đúng từ Firebase project cần kiểm thử. File `.env` bị Git ignore; không commit credential, service account hoặc private key.

Đối với Family Care, chỉ dùng Web App config của `medicare-ai-staging`, đặt `EXPO_PUBLIC_FIREBASE_PROJECT_ID=medicare-ai-staging` và bật các flag cần thiết sau khi owner phê duyệt. Chạy preflight ngoại tuyến từ thư mục `expo-app/`:

```powershell
node scripts/check-family-care-staging.mjs --project medicare-ai-staging
```

Preflight khóa đúng Project ID staging, Sender ID và Web App ID theo Project Number đã duyệt; chặn production và Emulator project. Preflight không kết nối Firebase, không xác minh Rules đã deploy và không deploy tài nguyên.

Chỉ sau khi owner review `firestore.rules` và `firestore.indexes.json`, preflight PASS, và xác nhận Firebase Console đang mở đúng Staging project, mới chạy từ `expo-app/`:

```powershell
npx firebase-tools@15.34.1 --config ../firebase.json deploy --only firestore:rules,firestore:indexes --project medicare-ai-staging
```

Lệnh trên chỉ deploy Firestore Rules và Indexes vào Staging. Không deploy Functions, Storage hoặc Hosting; không thay đổi Billing. Không chạy lệnh deploy trên Production. Trong PR này chưa thực hiện bất kỳ thao tác deploy Firebase nào.

**Giới hạn dữ liệu cần biết:** Firestore Rules cho phép caregiver đọc toàn bộ field của document thuốc/lịch đang active; Rules không thể lọc field riêng lẻ trong một document. Owner UI nêu rõ phạm vi chia sẻ, caregiver UI chỉ hiển thị tên thuốc và giờ dự kiến, đồng thời client xác thực schema. Nếu cần bảo đảm field-level access ở backend, phải chuyển sang thiết kế projection document riêng trước khi mở rộng phạm vi sử dụng.

## Chạy ứng dụng

Yêu cầu: Node.js 24.12.0 và npm. Tất cả lệnh dưới đây chạy trong `expo-app/`, không chạy từ thư mục gốc repository.

```powershell
cd expo-app
npm ci
npm run typecheck
npm run lint
npm test
npm run test:rules
npx expo start --clear --lan
```

Expo Android/iOS export:

```powershell
npx expo export --platform android --output-dir <output-directory>
npx expo export --platform ios --output-dir <output-directory>
```

## Family Care — release gate

- Một chiều: owner tạo mã mời; caregiver claim; owner xác minh và phê duyệt UID.
- Chỉ link `active` mới cho phép đọc thuốc/lịch. Caregiver không được ghi sửa, đọc DoseEvents, OCR hoặc dữ liệu không active.
- Owner revoke sẽ dừng listener sức khỏe; các lần đọc mới bị Firestore Rules từ chối.
- Link `revoked`/`rejected` chỉ có thể quay lại `pending` khi caregiver claim mã mời mới do owner phát hành; owner phải phê duyệt lại.
- Feature flag mặc định tắt. Chỉ bật trên Staging sau khi Rules/Indexes được owner duyệt và deploy.
- Dùng hai tài khoản test và dữ liệu giả. Chưa coi staging/device QA là hoàn tất nếu chưa ghi nhận kết quả checklist trong [Family Care release checklist](docs/family-care-owner-approved-links.md).

## Tài liệu chính

- [Expo app README](expo-app/README.md)
- [Mô hình dữ liệu Firestore](docs/firestore-data-model.md)
- [Firebase Security Rules](docs/firebase-security.md)
- [Firebase JavaScript SDK Integration](docs/firebase-js-sdk-integration.md)
- [Firebase Authentication](docs/firebase-authentication.md)
- [Firestore User Profiles](docs/firestore-user-profiles.md)
- [Medication Management M3.1](docs/medication-management-m3.1.md)
- [Firestore Medication CRUD M3.2](docs/medication-management-m3.2.md)
- [Medication Schedules M3.3](docs/medication-schedules-m3.3.md)
- [Medication workflow and local reminders](docs/medication-workflow-finalization.md)
- [Prescription OCR — AI Phase 1](docs/prescription-ocr-ai-phase-1.md)
- [Family Care owner-approved links and QA checklist](docs/family-care-owner-approved-links.md)

## Mã nguồn Flutter cũ

Các thư mục Flutter cũ ở repository root (`lib/`, `android/`, `test/` và các file `pubspec.*`) không còn là ứng dụng được hỗ trợ, không thuộc luồng build/release hiện hành và không được dùng làm baseline cho tính năng mới. Chúng được giữ lại tạm thời để tham chiếu lịch sử; ứng dụng đang phát triển là `expo-app/`.

# Firestore User Profiles & Role Security — Migration 2.3

## Trạng thái triển khai

Migration 2.3 đã triển khai Cloud Firestore Native database `(default)` tại
`asia-east1` trong project `medicare-ai-cf804`. Rules M2.3 từ
[`../firestore.rules`](../firestore.rules) đã được release bằng lệnh scope hẹp:

```powershell
firebase deploy --only firestore:rules --project medicare-ai-cf804
```

Baseline production deny-all trước release, checksum source deployed và quy
trình rollback được lưu tại
[`firestore-production-deny-all-baseline.md`](firestore-production-deny-all-baseline.md).
Không có Storage Rules, indexes, Functions hoặc feature flag nào được deploy
cùng release đó.

Điều này không thay đổi nguyên tắc an toàn sau:

- `npm run test:rules` vẫn chỉ xác minh Rules local trong Firestore Emulator;
  nó không thay thế kiểm tra runtime trên thiết bị.
- `.env.example` mặc định tắt profile. Chỉ project owner mới có thể bật
  `EXPO_PUBLIC_FIRESTORE_USER_PROFILES_ENABLED=true` trong `.env` local bị Git
  ignore để kiểm thử đã phê duyệt.
- Khi feature tắt, user đã Auth thấy error gate rõ ràng; app không tạo role
  mock, không chọn dashboard mặc định và không âm thầm đổi Firebase project.
- Chủ dự án đã cho biết đã thực hiện kiểm thử profile trên iPhone, nhưng các
  case pass/fail cụ thể không được ghi nhận trong repository. Không suy ra rằng
  toàn bộ checklist bên dưới đã pass.

`EXPO_PUBLIC_FIRESTORE_USER_PROFILES_ENABLED` là cờ public được Expo nhúng vào
bundle, không phải secret và **không phải** lớp authorization. Không đặt service
account, private key, password, token hay credential server ở bất kỳ biến
`EXPO_PUBLIC_*` nào.

## Phạm vi được triển khai

Chỉ surface sau có repository client:

```text
/users/{auth.uid}
```

Repository lấy UID trực tiếp từ Firebase Auth. UI không truyền UID, không gọi
Firebase SDK trực tiếp và không có API đổi role. Profile tạo lần đầu dùng
Firestore transaction: nếu document đã tồn tại do request đồng thời, document
tồn tại được đọc lại thay vì ghi đè role. `serverTimestamp()` tạo
`createdAt`/`updatedAt`.

Firebase Firestore persistence không được bật cho React Native/Expo. AsyncStorage
chỉ lưu Firebase Auth session; app không hứa hẹn Firestore profile offline sau
khi khởi động lại.

### Schema portable

| Field | Giá trị/quy tắc |
| --- | --- |
| `uid` | Bằng Firebase Auth UID và bất biến |
| `displayName` | String 2–120 ký tự; được phép cập nhật bởi owner |
| `primaryRole` | Chính xác `elderly` hoặc `caregiver`; bất biến |
| `roles` | Map exact `elderly`/`caregiver` boolean; khớp duy nhất với `primaryRole`; bất biến |
| `locale` | `vi`; có thể cập nhật trong schema hiện tại |
| `timeZone` | `Asia/Ho_Chi_Minh`; có thể cập nhật trong schema hiện tại |
| `onboardingCompleted` | `true`; bất biến |
| `createdAt` | Server timestamp khi tạo; bất biến |
| `updatedAt` | Server timestamp khi tạo/cập nhật |

Role profile chỉ định giao diện mà user thấy sau khi đăng nhập. Nó không cấp quyền
đọc medication, schedule, dose, prescription/OCR, family link hay dữ liệu của
người khác.

## Route policy

Auth observer là nguồn session. Sau khi một user Auth được quan sát:

1. App tải profile của chính UID đó khi feature đã bật.
2. Profile chưa tồn tại chỉ có thể vào `/role-selection`.
3. Profile `elderly` chỉ có thể vào `/elderly`; profile `caregiver` chỉ có thể
   vào `/caregiver`.
4. Loading, malformed profile, permission/network error hoặc feature tắt hiển
   thị initialization/error gate; không route tới dashboard.
5. Logout/account switch vô hiệu hóa request profile cũ trước khi route mới
   được mở.

`Stack.Protected` của Expo Router là UX client-side. Rules dưới đây mới quyết
định Firestore request có hợp lệ hay không.

## Rules deployed và Emulator

`firestore.rules` hiện default-deny. Policy M2.3 cho phép owner:

- `get` chính `/users/{uid}`; không có `list` hoặc query collection.
- `create` khi document exact schema, UID trùng Auth UID, một role hợp lệ và
  `createdAt`/`updatedAt` bằng `request.time`.
- `update` chỉ `displayName`, `locale`, `timeZone`, `updatedAt`; UID, roles,
  primary role, created timestamp và onboarding không được đổi.

Rules chặn delete, subcollections của profile, direct client caregiver link/
invite và mọi collection health/medication/schedule/device/index/audit future.

Từ `expo-app/`, chạy:

```powershell
npm run test:rules
```

Lệnh gọi Firestore Emulator qua `firebase emulators:exec`, nạp Rules ở root từ
`firebase.json` và chạy test với project/UID tổng hợp. Bộ test cover owner
create/read/update, cross-user access, unauthenticated access, role/UID/field
spoofing, delete/overwrite và direct caregiver/health writes. Nó không bật API
production, deploy Rules hoặc truy cập dữ liệu thật.

## Vận hành feature profile sau deployment

Rules production đã được owner phê duyệt và deploy. Bật profile vẫn là thao tác
local, có chủ đích và không phải rollout toàn cục:

1. Review `firestore.rules`, baseline rollback và các advisory dependency hiện
   có trước mỗi thay đổi Rules sau này.
2. Trong `.env` local bị Git ignore của người kiểm thử, đặt
   `EXPO_PUBLIC_FIRESTORE_USER_PROFILES_ENABLED=true`.
3. Chạy `npx expo start --clear` để Expo bundle lại biến public.
4. Chỉ dùng Firebase Auth test accounts và dữ liệu identity giả lập; không tạo
   medication, prescription, OCR, caregiver link hay dữ liệu sức khỏe.
5. Không deploy lại Rules, Storage, indexes hoặc Functions trong quy trình này.

## Kiểm thử iPhone sau approval

1. Dùng Expo Go SDK 58 trên iPhone và tài khoản Firebase test riêng, không dùng
   thông tin hay dữ liệu y tế thật.
2. Đăng ký/đăng nhập: user mới không có profile phải thấy Role Selection.
3. Chọn một role; reload/reopen app và xác nhận đi tới dashboard của role đã lưu.
4. Thử deep link/back tới dashboard role còn lại; Expo Router phải chặn route.
5. Dùng Firebase Console/Rules Emulator theo quy trình được duyệt để xác minh
   user khác không đọc profile này. Không tự tạo active caregiver link hay data
   health để thử workaround.

Chủ dự án đã xác nhận đã thực hiện kiểm thử profile trên iPhone. Các case cụ
thể trong checklist chỉ được coi là pass khi có bằng chứng riêng được ghi nhận;
tài liệu này không tự đánh dấu chúng đã hoàn thành.

## Không thuộc Migration 2.3

- Firestore CRUD cho medication, schedules, dose events, OCR/prescriptions hay
  dữ liệu sức khỏe thật.
- Caregiver/family invite, approval, revoke hoặc quyền đọc health data.
- Cloud Functions, Admin SDK, FCM, Analytics health data, App Check enforcement
  hoặc Firestore offline persistence.
- Deploy lại Rules, migration dữ liệu hoặc thay đổi database configuration.

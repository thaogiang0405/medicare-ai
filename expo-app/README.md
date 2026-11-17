# MediCare AI — Expo Migration + Firebase Authentication foundation

Đây là ứng dụng React Native + Expo mới của MediCare AI. Ứng dụng Flutter
nguyên bản vẫn được giữ nguyên ở thư mục gốc của repository; toàn bộ mã Expo
chỉ nằm trong `expo-app/` để đội ngũ có thể đối chiếu và chuyển đổi dần.

> MediCare AI hỗ trợ ghi nhận thông tin và không thay thế bác sĩ. Trạng thái
> “Đã uống” là tự báo cáo của người dùng, không phải xác nhận y tế.

## Phạm vi hiện tại

- Expo SDK 58, React Native và TypeScript ở chế độ `strict`.
- Expo Router cho điều hướng theo tệp.
- Zustand cho state trong bộ nhớ của phiên chạy.
- Thiết kế tiếng Việt ưu tiên người cao tuổi: chữ lớn, tương phản cao, vùng
  chạm tối thiểu 56 px và nhãn trợ năng rõ ràng.
- Luồng giao diện mock: Splash, Onboarding, Đăng nhập, Đăng ký, chọn vai trò,
  trang chủ Người cao tuổi và dashboard Người chăm sóc.
- Firebase JavaScript SDK modular được khởi tạo từ Firebase Web App chính thức
  của `medicare-ai-cf804`; Firebase Authentication Email/Password dùng
  persistence React Native chính thức với AsyncStorage.
- `FirebaseAuthRepository` là ranh giới duy nhất giữa UI và Firebase Auth.
  Mock repository chỉ còn dùng cho dữ liệu thuốc/lịch và trong test.
- Không có Firestore CRUD, dữ liệu sức khỏe thật, phân quyền backend hay đồng
  bộ gia đình.

Không triển khai trong Migration 2.2: Firestore CRUD, hồ sơ/phân quyền backend,
OCR, TTS/STT nâng cao, thông báo đẩy, đồng bộ gia đình hoặc deploy Firebase
Rules.

## Cấu trúc

```text
expo-app/
  src/app/                 # Expo Router routes (route root của template SDK 58)
  src/
    components/            # Design system và UI dùng lại
    constants/             # Theme, token trợ năng
    features/              # Domain/data boundaries theo feature
    services/firebase/     # Firebase Core initializer và future boundaries
    store/                 # Zustand in-memory stores
    types/                 # Kiểu dùng chung
    utils/                 # Tiện ích thuần
```

Chi tiết quyết định kiến trúc và kế hoạch chuyển đổi ở
[`../docs/migration-to-expo.md`](../docs/migration-to-expo.md).

## Cài đặt và chạy

Yêu cầu Node.js 22.13+ và npm. Expo SDK 58 được ghim trong `package.json` để
tương thích Expo Go SDK 58 trên iPhone.

```powershell
cd expo-app
npm install
npx expo-doctor@latest
npx expo lint
npx tsc --noEmit
npm test
npx expo start --clear
```

### Thử trên iPhone với Expo Go

1. Cài **Expo Go** từ App Store trên iPhone.
2. Đặt iPhone và máy phát triển vào cùng mạng Wi-Fi.
3. Tại `expo-app/`, chạy `npx expo start --clear`.
4. Mở Expo Go và quét QR code Expo CLI hiển thị.

Nếu LAN bị tường lửa hoặc router chặn kết nối, chạy:

```powershell
npx expo start --tunnel
```

Tunnel cần Internet và có thể chậm hơn LAN. Migration 2.2 đã được người kiểm
thử xác nhận chạy thành công trên iPhone thật bằng Expo Go SDK 58; các thay đổi
Firebase Authentication vẫn không bao gồm Firestore hay dữ liệu sức khỏe thật.

## Firebase JavaScript SDK — Migration 2.2

Firebase Web App chính thức của project `medicare-ai-cf804` được đọc từ
`expo-app/.env`, không từ cấu hình Android Flutter. Copy `.env.example` thành
`.env` rồi điền config do Firebase Console hoặc Firebase CLI cung cấp:

```powershell
Copy-Item .env.example .env
```

`EXPO_PUBLIC_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`,
`STORAGE_BUCKET`, `MESSAGING_SENDER_ID` và `APP_ID` là bắt buộc;
`MEASUREMENT_ID` là tùy chọn vì Analytics chưa nằm trong phạm vi. Expo nhúng
mọi biến `EXPO_PUBLIC_*` vào ứng dụng, vì vậy chúng không thể chứa secret.
Không commit service account, private key, token, mật khẩu hoặc `.env` cục bộ.

Ứng dụng khởi tạo Firebase Core trước route đầu tiên. Nếu thiếu config, một màn
hình lỗi rõ ràng sẽ hiển thị thay vì âm thầm chuyển sang project hay mock
Firebase khác. Sau đó, Firebase Auth được khởi tạo bằng `initializeAuth()` và
`getReactNativePersistence(AsyncStorage)` trước khi khôi phục phiên qua
`onAuthStateChanged`. Zustand chỉ giữ trạng thái UI; không lưu password, ID
token hoặc refresh token.

Trong Firebase Console, bật **Authentication → Sign-in method → Email/Password**
trước khi thử đăng ký/đăng nhập. Đặt password policy và xác nhận email
enumeration protection theo hướng dẫn trong tài liệu bên dưới. Expo Router chặn
route riêng tư ở phía client, nhưng đây không thay thế Firebase Security Rules
hoặc phân quyền backend.

Xem [hướng dẫn Firebase JS SDK](../docs/firebase-js-sdk-integration.md) và
[Firebase Authentication — Migration 2.2](../docs/firebase-authentication.md)
để lấy cấu hình trên máy thành viên khác, bật provider và kiểm thử bằng Expo Go.

Expo Go dùng native container riêng. Trước EAS/development build, nhóm cần
quyết định Android/iOS identifiers và Firebase client apps của Expo một cách có
chủ đích; Migration 1 không tự tái sử dụng hay thay đổi applicationId Flutter.

## Kiểm tra

Các lệnh kiểm tra có chủ đích:

```powershell
npm install
npx expo-doctor@latest
npx expo lint
npx tsc --noEmit
npm test
npx expo export --platform ios
```

Chỉ chạy `npm test` sau khi test runner đã được cấu hình. Xem kết quả thực tế
của lần kiểm tra trong báo cáo Migration 1, không suy ra kết quả từ tài liệu
này.

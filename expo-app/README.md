# MediCare AI — Expo Migration 1

Đây là ứng dụng React Native + Expo mới của MediCare AI. Ứng dụng Flutter
nguyên bản vẫn được giữ nguyên ở thư mục gốc của repository; toàn bộ mã Expo
chỉ nằm trong `expo-app/` để đội ngũ có thể đối chiếu và chuyển đổi dần.

> MediCare AI hỗ trợ ghi nhận thông tin và không thay thế bác sĩ. Trạng thái
> “Đã uống” là tự báo cáo của người dùng, không phải xác nhận y tế.

## Phạm vi Migration 1

- Expo SDK 57, React Native và TypeScript ở chế độ `strict`.
- Expo Router cho điều hướng theo tệp.
- Zustand cho state trong bộ nhớ của phiên chạy.
- Thiết kế tiếng Việt ưu tiên người cao tuổi: chữ lớn, tương phản cao, vùng
  chạm tối thiểu 56 px và nhãn trợ năng rõ ràng.
- Luồng giao diện mock: Splash, Onboarding, Đăng nhập, Đăng ký, chọn vai trò,
  trang chủ Người cao tuổi và dashboard Người chăm sóc.
- Repository mock cho auth, thuốc và lịch dùng thuốc. Không có dữ liệu sức
  khỏe thật, không có xác thực thật và không lưu dữ liệu lâu dài.

Không triển khai trong Migration 1: Firebase Authentication, Firestore CRUD,
OCR, TTS/STT nâng cao, thông báo đẩy, đồng bộ gia đình hoặc deploy Firebase
Rules.

## Cấu trúc

```text
expo-app/
  src/app/                 # Expo Router routes (route root của template SDK 57)
  src/
    components/            # Design system và UI dùng lại
    constants/             # Theme, token trợ năng
    features/              # Domain/data boundaries theo feature
    services/              # Chỉ service contracts trong Migration 1
    store/                 # Zustand in-memory stores
    types/                 # Kiểu dùng chung
    utils/                 # Tiện ích thuần
```

Chi tiết quyết định kiến trúc và kế hoạch chuyển đổi ở
[`../docs/migration-to-expo.md`](../docs/migration-to-expo.md).

## Cài đặt và chạy

Yêu cầu Node.js 20+ và npm. Expo SDK 57 được ghim trong `package.json`; không
nâng SDK chỉ để dùng Expo Go mới hơn nếu chưa xác minh tương thích.

```powershell
cd expo-app
npm install
npx expo-doctor
npx tsc --noEmit
npx expo start
```

### Thử trên iPhone với Expo Go

1. Cài **Expo Go** từ App Store trên iPhone.
2. Đặt iPhone và máy phát triển vào cùng mạng Wi-Fi.
3. Tại `expo-app/`, chạy `npx expo start`.
4. Mở Expo Go và quét QR code Expo CLI hiển thị.

Nếu LAN bị tường lửa hoặc router chặn kết nối, chạy:

```powershell
npx expo start --tunnel
```

Tunnel cần Internet và có thể chậm hơn LAN. Việc mở QR code thành công trên
iPhone là bước kiểm thử thiết bị thực; tài liệu này không khẳng định iOS đã
được xác minh trước khi bước đó diễn ra.

## Firebase

Firebase Project dùng chung là `medicare-ai-cf804`, nhưng ứng dụng Expo **chưa
khởi tạo Firebase**. Firebase JavaScript SDK cần cấu hình chính thức của một
Firebase Web App thuộc project đó. Không sao chép `firebase_options.dart` của
Flutter sang TypeScript và không tự tạo cấu hình giả.

Trước khi tích hợp Firebase trong Migration 2, chủ project cần đăng ký/chọn
Firebase Web App chính thức rồi cung cấp cấu hình client phù hợp. Firebase
client configuration không phải server secret, nhưng các file service account,
private key, token, mật khẩu và `.env` nhạy cảm tuyệt đối không được commit.

Expo Go dùng native container riêng. Trước EAS/development build, nhóm cần
quyết định Android/iOS identifiers và Firebase client apps của Expo một cách có
chủ đích; Migration 1 không tự tái sử dụng hay thay đổi applicationId Flutter.

## Kiểm tra

Các lệnh kiểm tra có chủ đích:

```powershell
npm install
npx expo-doctor
npx tsc --noEmit
npm test
```

Chỉ chạy `npm test` sau khi test runner đã được cấu hình. Xem kết quả thực tế
của lần kiểm tra trong báo cáo Migration 1, không suy ra kết quả từ tài liệu
này.

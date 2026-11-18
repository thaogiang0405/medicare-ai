# MediCare AI — Firebase Authentication (Migration 2.2)

## Phạm vi

Migration 2.2 thay luồng đăng nhập giả bằng Firebase Authentication Email/
Password của Firebase project `medicare-ai-cf804`. Ứng dụng Expo dùng Firebase
JavaScript SDK modular và `@react-native-async-storage/async-storage` để
Firebase tự duy trì phiên trên iOS/Android.

Đây **không** phải là phân quyền y tế. Tài liệu này mô tả trạng thái Migration
2.2 tại thời điểm hoàn thành; Migration 2.3 đã thêm profile Firestore giới hạn
để `AppUser.role` được lấy từ document của chính tài khoản sau khi Auth observer
khôi phục phiên. Role chỉ quyết định route UI, không cấp quyền đọc dữ liệu sức
khỏe. Xem [Firestore User Profiles — Migration 2.3](firestore-user-profiles.md)
cho scope hiện tại. Firestore CRUD cho thuốc/lịch, chia sẻ gia đình và dữ liệu
thuốc thật vẫn nằm ngoài M2.3; chỉ Rules owner-profile đã được deploy.

## Trạng thái xác minh

Luồng Email/Password, điều hướng và persistence đã được người kiểm thử xác
nhận chạy thành công trên iPhone thật bằng Expo Go SDK 58. Xác minh đó không
bao gồm Firestore, phân quyền backend, Firebase Emulator hay dữ liệu sức khỏe
thật.

## Thiết lập Firebase Console bắt buộc

Chủ project cần xác nhận các thiết lập sau trước khi thử trên thiết bị thật:

1. Vào **Firebase Console → Authentication → Sign-in method**.
2. Bật **Email/Password** và lưu thay đổi.
3. Vào **Authentication → Settings → Password policy** để chọn chính sách mật
   khẩu. Ứng dụng kiểm tra chính sách qua `validatePassword`, nhưng Firebase
   vẫn là nguồn quyết định cuối cùng.
4. Vào **Authentication → Settings → User actions** và bảo đảm **Email
   enumeration protection** được bật.

Các thao tác trên thay đổi môi trường Firebase nên không được tự động thực hiện
qua source code. Không dùng service account hoặc Firebase Admin SDK trong Expo.

## Kiến trúc

```text
Firebase Web config (.env, ignored)
  → Firebase App singleton
  → initializeAuth + React Native AsyncStorage persistence
  → FirebaseAuthRepository
  → Zustand session + profile gate
  → FirestoreUserProfileRepository (khi feature flag được duyệt)
  → Expo Router Stack.Protected theo profile role
```

- `firebase-auth-boundary.ts` gọi `initializeAuth()` trước, truyền
  `getReactNativePersistence(AsyncStorage)`, và chỉ gọi `getAuth()` khi Fast
  Refresh báo Auth đã được khởi tạo.
- `FirebaseAuthRepository` là nơi duy nhất gọi Firebase Auth APIs. UI chỉ dùng
  `AuthRepository` qua Zustand.
- `onAuthStateChanged` là nguồn trạng thái để khôi phục phiên khi mở lại app.
- Auth observer tải profile trước khi route riêng tư được mở. Profile thiếu chỉ
  cho phép role onboarding; profile lỗi hoặc feature flag tắt hiển thị error
  gate, không có fallback role.
- Zustand chỉ giữ `AppUser`, profile đã map, trạng thái khởi tạo và lỗi trình
  bày. Nó không lưu mật khẩu, ID token hay refresh token.
- `Stack.Protected` chặn route theo authentication và role profile; khi logout,
  Expo Router loại history của route protected. Đây vẫn chỉ là chặn client-side;
  Firestore Rules mới là lớp authorization cho dữ liệu.

## Hành vi Auth

- Đăng ký dùng email/mật khẩu, kiểm tra password policy và cập nhật
  `displayName` Firebase profile.
- Đăng nhập sử dụng email/mật khẩu; lỗi credential được gộp thành thông báo
  trung lập, không xác nhận email có tồn tại hay không.
- Quên mật khẩu dùng `sendPasswordResetEmail`; UI luôn hiển thị phản hồi trung
  lập khi request phù hợp.
- Đăng xuất gọi Firebase Auth và xóa session/dữ liệu demo trong bộ nhớ trước
  khi quay lại Login.

## Kiểm thử iPhone với Expo Go SDK 58

1. Trên Windows, vào `expo-app/` và chạy:

   ```powershell
   npx expo start --clear
   ```

2. Đặt iPhone cùng Wi-Fi, mở Expo Go SDK 58 và quét QR. Nếu LAN bị chặn, dùng
   `npx expo start --tunnel`.
3. Đăng ký bằng **Firebase Auth test account riêng** và mật khẩu tuân theo policy
   đã bật trong Firebase Console. Không dùng dữ liệu nhận diện hoặc mật khẩu thật.
4. Trong Firebase Console → Authentication → Users, xác nhận user mới xuất
   hiện. Chỉ làm sau khi Email/Password provider đã bật.
5. Đóng màn hình project trong Expo Go hoặc khởi động lại Expo Go, rồi mở lại
   cùng project. Không xóa dữ liệu Expo Go hoặc cài lại ứng dụng. Auth gate phải
   khôi phục phiên. Khi feature Profile đã được chủ project bật và Rules đã
   deploy, tài khoản chưa có document chỉ tới màn chọn role một lần; tài khoản
   có profile đi thẳng tới dashboard role đã lưu. Khi feature tắt, app hiển thị
   error gate rõ ràng thay vì vào dashboard.
6. Dùng **Đăng xuất**, sau đó thử nút Back hoặc mở trực tiếp `/elderly`/
   `/caregiver`; navigation phải đưa về Login.

Việc đăng ký tài khoản thật không được tự động chạy trong test suite vì tạo dữ
liệu bên ngoài project. Test tự động dùng fake Auth port; kiểm thử iPhone ở trên
là bước xác minh runtime bắt buộc.

## Emulator tùy chọn

Khi nhóm đã cấu hình Firebase Auth Emulator, chỉ kết nối nó ở môi trường phát
triển bằng cấu hình được phê duyệt riêng. iPhone phải dùng địa chỉ IP LAN của
máy Windows, không dùng `localhost`. Không nhập credential thật vào emulator.

## Trạng thái sau Migration 2.3

Cloud Firestore `(default)` tại `asia-east1` và Rules M2.3 owner-profile đã
được project owner deploy. Khi feature flag profile được bật trong `.env` local
đã được phê duyệt, Auth observer tải đúng `/users/{auth.uid}` trước route role;
profile thiếu chỉ đi tới role onboarding và profile hợp lệ đi tới dashboard role
đã lưu. Đây vẫn không phải quyền đọc dữ liệu sức khỏe.

Chủ dự án đã cho biết đã thực hiện kiểm thử profile trên iPhone, nhưng không
cung cấp danh sách case pass/fail để tài liệu có thể xác nhận chi tiết. Xem
checklist và giới hạn tại
[`firestore-user-profiles.md`](firestore-user-profiles.md). Vẫn cần đánh giá
Firebase dependency advisories trước khi mở rộng Firestore.

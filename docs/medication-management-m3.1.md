# Medication Management Foundation — Migration 3.1

## Phạm vi

Migration 3.1 tạo giao diện và logic quản lý thuốc trong Expo cho tài khoản có
profile role `elderly`. Các route nằm dưới `/elderly/medications` và được bảo
vệ bởi parent route role `elderly`; caregiver hoặc người chưa xác thực không có
quyền mở chúng qua direct URL.

Màn hình có sẵn:

- **Thuốc của tôi**: danh sách, tìm theo tên, lọc trạng thái, loading/error/empty
  state và mở chi tiết.
- **Thêm thuốc**: chỉ ghi tên, hàm lượng/quy cách và hướng dẫn do người dùng
  cung cấp.
- **Chi tiết thuốc**: hiển thị rõ trường thiếu là `Chưa cung cấp`.
- **Chỉnh sửa thuốc**: cập nhật bản ghi hiện có, không tạo bản ghi mới.
- **Ngừng sử dụng**: yêu cầu xác nhận và chỉ chuyển `status` sang `inactive`;
  không xóa bản ghi hoặc DoseEvent demo.

Tất cả giao diện ghi rõ **Chế độ trình diễn**. Ứng dụng không suy luận liều,
tần suất, giờ uống, không tạo lịch nhắc và không đưa ra chỉ định y tế.

## Domain và mock repository

`Medication` giữ các field cốt lõi `id`, `name`, `strengthText`,
`directionsText`, `status`. `createdAt`/`updatedAt` là ISO timestamp in-memory
để chuẩn bị mapping M3.2; chúng không phải lịch sử lâm sàng.

Repository nhận `userId` nội bộ do session cung cấp cho mọi read/write. Mock
repository lưu `Map<uid, Medication[]>`, clone dữ liệu trả về và tạo bản demo
Metformin/Amlodipine riêng cho mỗi UID để tương thích DoseEvent demo cũ. Bản
ghi do tài khoản A tạo không thể được list/get/update/inactivate bằng UID B.

Đây chỉ là cô lập dữ liệu test trong bộ nhớ, **không phải** authorization
production. State hiển thị Zustand được xóa khi logout/switch account và request
cũ bị bỏ qua; repository cũng không dùng AsyncStorage. Toàn bộ dữ liệu reset khi
app runtime khởi động lại.

## Ranh giới Firebase và lịch demo

M3.1 không import Firestore cho Medication, không sửa `firestore.rules`, không
deploy Rules/indexes/Storage/Functions và không ghi dữ liệu thuốc lên Firebase.
Rules production M2.3 vẫn default-deny các collection medication/schedule/dose
và health data.

DoseEvent demo được tách theo UID để response của một account không hiện ở
account khác. Nó vẫn dùng hai ID medication demo ban đầu. Đánh dấu một thuốc
`inactive` không tạo/xóa/sửa DoseEvent hay lịch nhắc; dashboard có fallback an
toàn khi một medication ID không được tìm thấy.

## Validation và accessibility

- Tên thuốc bắt buộc, trim outer whitespace, tối đa 120 ký tự.
- Hàm lượng/quy cách tùy chọn, tối đa 80 ký tự.
- Hướng dẫn do người dùng ghi tùy chọn, tối đa 500 ký tự.
- Form chặn submit trùng trong khi mutation đang chạy, giữ nguyên input khi
  validation thất bại và báo lỗi tiếng Việt theo từng field.
- Nút/chip dùng touch target theo token 56 px, nhãn và hint trợ năng, font
  scaling, tương phản và keyboard-avoiding layout trên iPhone.

## Kiểm thử

Unit/component tests cover create/update/inactivate/validation/filter/not-found,
duplicate submission, owner isolation, reset/stale account switch, demo
DoseEvent isolation, role route policy và Medication List UI. Chạy từ
`expo-app/`:

```powershell
npx expo lint
npx tsc --noEmit
npm test -- --runInBand
npm run test:rules
npx expo export --platform ios
```

Chủ project đã xác nhận hoàn tất kiểm thử M3.1 trên iPhone bằng Expo Go SDK 58.
Repository chưa lưu evidence chi tiết cho từng trường hợp, vì vậy tài liệu không
suy diễn riêng persistence, đổi tài khoản hay từng thao tác form là đã pass. Để
lặp lại kiểm thử, chạy `npx expo start --clear`, mở bằng Expo Go SDK 58 với một
tài khoản test role `elderly`, rồi kiểm tra luồng list → add → detail → edit →
inactivate và đổi tài khoản.

## Chuẩn bị M3.2

Trước Firestore Medication CRUD, cần thiết kế schema cuối cùng, owner-only Rules
và emulator persona/query tests cho medication theo mô hình
[`firestore-data-model.md`](firestore-data-model.md). Cần tách migration dữ liệu,
timestamps/revision Firestore, schedule semantics và caregiver approval thành
milestone được review riêng; không bật chúng chỉ vì M3.1 đã có UI mock.

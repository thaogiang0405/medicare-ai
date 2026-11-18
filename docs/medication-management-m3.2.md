# Firestore Medication CRUD — Migration 3.2

## Phạm vi

M3.2 thay thế repository Medication in-memory bằng Firestore khi và chỉ khi
`EXPO_PUBLIC_FIRESTORE_MEDICATIONS_ENABLED=true` trong `expo-app/.env` cục bộ.
Mặc định flag là `false`, nên M3.1 mock vẫn là đường chạy an toàn. Flag là public
client configuration, không phải cơ chế authorization.

Khi bật, repository chỉ dùng đường dẫn
`elderlyProfiles/{auth.uid}/medications/{medicationId}`. Mỗi request đối chiếu
UID do store truyền với `FirebaseAuth.currentUser.uid`, sau đó Rules kiểm tra
`/users/{uid}` là profile `elderly` hợp lệ. Không có seed Metformin/Amlodipine
trong Firestore.

## DTO và concurrency

Mỗi document có exact fields: `ownerUid`, `name`, `strengthText`,
`directionsText`, `status`, `createdAt`, `updatedAt`, `revision`. Timestamps là
`serverTimestamp`; create bắt đầu tại revision `1`; update/inactivate dùng
Firestore transaction và tăng revision đúng một lần. `ownerUid`/`createdAt`
immutable, `inactive` không thể re-activate và delete bị từ chối.

Domain `Medication` không import Firebase SDK. Repository map DTO chưa tin cậy
về model portable và chỉ trả thông báo lỗi tiếng Việt an toàn. Store vẫn bỏ qua
result cũ sau logout/đổi tài khoản.

## Ranh giới còn lại

DoseEvent, lịch thuốc và phản hồi "Đã uống/Bỏ qua/Nhắc lại" vẫn là demo in-memory
riêng theo UID; chúng không được tạo từ Medication Firestore. M3.2 không triển
khai prescription, OCR, schedule, caregiver access, medication advice, Storage,
Functions, indexes hoặc deploy Rules.

## Chạy local sau khi Rules được phê duyệt và deploy riêng

Trong `expo-app/.env` đang bị Git ignore, giữ cấu hình Firebase Web chính thức,
profile flag đã được chấp thuận, rồi mới thêm:

```text
EXPO_PUBLIC_FIRESTORE_MEDICATIONS_ENABLED=true
```

Khởi động lại bằng `npx expo start --clear`. Chỉ kiểm thử bằng tài khoản giả lập
role `elderly`; không bật flag hoặc đưa dữ liệu sức khỏe thật vào production trước
khi chủ dự án phê duyệt deploy Rules riêng.

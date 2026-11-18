# Firebase security strategy

## Trạng thái triển khai thực tế

Cloud Firestore Native database `(default)` của `medicare-ai-cf804` hoạt động
tại `asia-east1`. `firestore.rules` trong repository là source M2.3 đã được
release lên production bằng `firebase deploy --only firestore:rules --project
medicare-ai-cf804`. Source SHA-256 của release được ghi tại
[`firestore-production-deny-all-baseline.md`](firestore-production-deny-all-baseline.md),
cùng baseline deny-all và thủ tục rollback có kiểm soát.

Rules Emulator pass là bằng chứng behavior local hữu ích, nhưng không thay thế
quản lý release, Console timeline hoặc kiểm thử runtime trên thiết bị. Không tự
deploy lại Rules, Storage, indexes hay thay đổi database configuration từ source
code.

## Nguyên tắc M2.3

1. Firebase Auth, `Stack.Protected`, feature flag và role selector chỉ điều
   khiển trải nghiệm client. Firestore Rules mới là lớp enforcement cho request
   từ client.
2. Client chỉ có surface profile `/users/{auth.uid}`. Repository luôn lấy UID
   từ Firebase Auth; UI không cung cấp UID, role hay timestamp authority.
3. `primaryRole`/`roles` xác định route UI đầu tiên, **không** cấp quyền đọc
   thuốc, lịch, OCR, family link hoặc dữ liệu sức khỏe của người khác.
4. Least privilege: `get` profile của chính mình có thể được phép; `list`, đọc
   chéo, delete, thay role/UID/created timestamp và mọi subcollection bị chặn.
5. Mọi collection health/caregiver/device/index/audit/notification chưa có
   schema + workflow server được duyệt đều default deny.
6. Không có Firebase Admin SDK, service account, private key, password hoặc
   token trong Expo client. `EXPO_PUBLIC_*` là giá trị nhúng vào client bundle,
   không được dùng để chứa secret.

## Rules M2.3 đang được version-control

| Surface | Policy local M2.3 |
| --- | --- |
| `/users/{uid}` `get` | Chỉ `request.auth.uid == uid` |
| `/users/{uid}` `list` | Deny |
| Create profile | Chỉ owner, exact schema, một role hợp lệ, server timestamps |
| Update profile | Chỉ owner; chỉ display name/locale/timezone/updated timestamp có thể đổi |
| Delete profile | Deny |
| `/users/{uid}/...` | Deny |
| Medications, schedules, doses, OCR, caregiver links/invites/indexes | Deny |
| Mọi path khác | Deny |

Role ban đầu được ràng buộc vào một map `elderly`/`caregiver` nhất quán với
`primaryRole`; Rules không cho client escalate thành nhiều role hay đổi role sau
khi tạo. Những restriction này không thay thế approval/invite workflow cho Family
Care trong milestone sau.

## Required authorization tests

Rules Emulator hiện dùng identity tổng hợp, không có dữ liệu sức khỏe thật. Bộ
test phải luôn gồm ít nhất các case sau:

| Scenario | Expected result |
| --- | --- |
| Unauthenticated read/write profile | Denied |
| Owner creates profile đúng schema | Allowed |
| Owner reads chính profile | Allowed |
| User A reads User B hoặc query/list profiles | Denied |
| Client đổi UID, role, role map, created timestamp hoặc thêm field | Denied |
| Owner update display name hợp lệ | Allowed |
| Direct create active caregiver link hoặc health document | Denied |

Chạy local từ `expo-app/`:

```powershell
npm run test:rules
```

Lệnh mở Firestore Emulator tạm thời, nạp `../firestore.rules` từ `firebase.json`
và chạy test với project/UID test riêng. Nó không deploy, không gọi database
production và không thay đổi Rules production đang active.

## Production hardening sau M2.3

- Chỉ thiết kế Rules cho medication/schedule/dose/OCR sau khi schema final và
  emulator personas/query tests được review.
- Thiết kế invite/approval/revoke qua workflow server-trusted (ví dụ Cloud
  Functions) trước khi cho caregiver đọc bất kỳ dữ liệu health nào.
- Enable App Check theo rollout có kiểm chứng; xác nhận email/phone verification
  policy, data retention, consent, revoke behavior và incident process trước dữ
  liệu thật.
- Không ghi raw prescription/OCR, token hoặc health metadata vào analytics/log.
- Notification lock-screen phải generic; Firebase server credentials chỉ được
  đặt trong secret manager với IAM tối thiểu khi milestone server được duyệt.

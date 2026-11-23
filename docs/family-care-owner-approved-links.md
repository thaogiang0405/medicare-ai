# Family Care: liên kết hai tài khoản có chấp thuận (MVP Spark)

## Trạng thái

Đây là nhánh thử nghiệm riêng từ migration/expo-sdk58, không phải tính năng chia sẻ tin nhắn trong PR #6. Đã có mã nguồn giao diện hai vai trò và Security Rules nhưng **chưa deploy** lên Firebase production và mặc định tắt qua EXPO_PUBLIC_FAMILY_CARE_ENABLED=false.

## Luồng liên kết thật

1. Người chăm sóc đăng nhập tài khoản có role caregiver và bấm "Chia sẻ mã người chăm sóc". Mã là Firebase Auth UID, không phải mật khẩu hoặc mã tự cấp quyền. Gửi cho đúng người cao tuổi qua kênh tin cậy.
2. Người cao tuổi đăng nhập tài khoản role elderly, dán UID người chăm sóc trong mục "Liên kết người chăm sóc". Xác minh danh tính bên ngoài ứng dụng và bấm "Xem và xác nhận cấp quyền", sau đó "Tôi đồng ý cấp quyền".
3. Rules kiểm tra tài khoản elderly là chủ hồ sơ và UID đích có role caregiver thực. Chỉ chủ hồ sơ được tạo document liên kết tại elderlyProfiles/{elderlyUid}/caregiverLinks/{caregiverUid}, với scope medicationsRead=true và schedulesRead=true.
4. Sau khi cấp quyền thành công, người cao tuổi bấm "Gửi mã hồ sơ của tôi cho người chăm sóc". Caregiver nhập UID elderly trong "Mã hồ sơ người cao tuổi" rồi bấm "Xem lịch người thân". Màn hình có listener Firestore cho thuốc/lịch đang hoạt động của đúng chủ hồ sơ đã cấp quyền.
5. Người cao tuổi có thể bấm "Thu hồi quyền". Rules dừng cho phép caregiver đọc tiếp. Link cùng cặp UID đã revoked không thể bật lại trong MVP (chủ hồ sơ cũng không thể xóa). Dữ liệu từng xem/chụp màn hình bên ngoài không thể thu hồi.

UID là mã định danh để chỉ đúng hồ sơ, không phải bí mật hay bằng chứng nhận dạng. Cần xác minh đúng người ở bước cấp quyền. Không có tính năng gửi yêu cầu tự động hoặc liên kết bằng QR/mã ngắn; đó là các phần UX sau.

## Quyền truy cập

- Owner elderly vẫn sở hữu và sửa thuốc/lịch của chính mình.
- Caregiver chỉ đọc danh sách thuốc và lịch trong Firestore; UI hiển thị mốc giờ và tên thuốc, không có nút sửa, không báo đã uống. Rules vẫn từ chối caregiver đọc DoseEvents/lịch sử, OCR, user profile khác, tạo/chỉnh sửa thuốc và lịch.
- Rules không cho caregiver tự tạo link, list link của chủ hồ sơ, cấp thêm quyền, hoặc tự phục hồi link đã revoked.
- Dữ liệu đọc trực tuyến chỉ hiển thị sau khi listener nhận xác nhận server; khi quyền bị từ chối hoặc mất kết nối, UI ẩn dữ liệu đã hiển thị. Tính giờ theo Asia/Ho_Chi_Minh; qua ngày mới có thể cần kết nối lại.

## Miễn phí và an toàn triển khai

Sử dụng Firebase Auth + Firestore trên Spark, không có Cloud Functions, FCM hay dịch vụ trả phí, không tự nâng cấp Billing. Kiểm tra role và liên kết bằng Rules có dùng exists/get, nghĩa là có thêm lượt đọc phụ thuộc và sử dụng quota Firestore miễn phí. Không có đảm bảo chạy vượt quota Spark.

Trước khi bất kỳ tài khoản thật nào được phép kết nối, chủ dự án phải duyệt toàn bộ changeset Rules, chạy emulator và phê duyệt release riêng. Không tự deploy Rules, Indexes, Storage, Functions hoặc đổi project. Chỉ bật flag Family Care thủ công trong .env khi Rules phù hợp đã được phát hành và hai role đã có hồ sơ test.

## Kiểm thử

Chạy tại expo-app/ trong nhánh feature/owner-approved-family-links:

    npm run typecheck && npm run lint && npm test
    npm run test:rules

Lệnh test:rules chạy Firestore Emulator cục bộ, có thể cần Java/Firebase CLI. Nó không deploy gì lên production. Test Rules phải xác nhận: không link → deny; caregiver tự approve → deny; elderly cấp đúng UID caregiver → allow chỉ đọc thuốc/lịch; đọc của owner khác hoặc ghi thuốc/lịch → deny; chủ hồ sơ revoke → không đọc tiếp và không thể re-active.

Sau khi Rules được xét duyệt và triển khai có chủ đích, dùng hai tài khoản test riêng (không dùng dữ liệu y tế thật), lần lượt trao đổi UID, approve, xem lịch live, sửa một lịch để kiểm tra thay đổi, revoke để kiểm tra mất quyền, đổi account để kiểm tra xóa dữ liệu.

**Chưa thực hiện test Expo Go hoặc Emulator trên máy người dùng ở commit này; PR cần được giữ Draft trước khi có kết quả.**

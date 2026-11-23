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
- Caregiver có quyền **đọc toàn bộ field của document thuốc/lịch đang hoạt động** sau khi được owner cấp quyền, bao gồm hàm lượng và hướng dẫn dùng. Rules chặn đọc thuốc/lịch đã ngừng hoạt động; các truy vấn caregiver bắt buộc lọc `status == active` và `active == true`. Firestore Rules **không thể che riêng từng field khi cho phép đọc document**. UI chỉ trình bày tên thuốc đang dùng và lịch hôm nay. Không có nút sửa, không báo đã uống hoặc đọc DoseEvents. Cần xác minh đúng người nhận và xem lại phạm vi chia sẻ khi duyệt release. Rules vẫn từ chối caregiver đọc DoseEvents/lịch sử, OCR, user profile khác, tạo/chỉnh sửa thuốc và lịch.
- Rules không cho caregiver tự tạo link, list link của chủ hồ sơ, cấp thêm quyền, hoặc tự phục hồi link đã revoked.
- Khi chủ hồ sơ tải lại danh sách người được cấp quyền, ứng dụng đọc trực tiếp từ Firestore server, không dùng cache để xác nhận quyền. Chỉ phản hồi mới nhất được dùng để cập nhật danh sách (tránh lần tải cũ ghi đè trạng thái revoked). Thu hồi quyền dùng transaction với revision mới nhất; nếu offline, thao tác thất bại có thông báo và không báo thành công giả. Cấp quyền vẫn phải do chủ hồ sơ xác nhận rõ ràng.
- Dữ liệu đọc trực tuyến chỉ hiển thị sau khi listener nhận xác nhận server; khi quyền bị từ chối hoặc mất kết nối, UI ẩn dữ liệu đã hiển thị. Nếu bất kỳ bản ghi thuốc/lịch đang hoạt động nào có cấu trúc sai, toàn bộ lịch bị ẩn và hiện lỗi; không âm thầm bỏ qua một thuốc rồi trình bày lịch thiếu. Tính giờ theo Asia/Ho_Chi_Minh và **tự làm mới lịch dự kiến vào 00:00 giờ Việt Nam** khi màn hình vẫn đang mở. Khi thoát màn hình hoặc quyền bị thu hồi, listener/timer đều phải được ngắt. Màn hình caregiver còn dùng generation token để bỏ qua callback tới muộn từ hồ sơ đã đóng/chuyển, tránh lẫn dữ liệu giữa hai người.

## Miễn phí và an toàn triển khai

Sử dụng Firebase Auth + Firestore trên Spark, không có Cloud Functions, FCM hay dịch vụ trả phí, không tự nâng cấp Billing. Kiểm tra role và liên kết bằng Rules có dùng exists/get, nghĩa là có thêm lượt đọc phụ thuộc và sử dụng quota Firestore miễn phí. Không có đảm bảo chạy vượt quota Spark.

Trước khi bất kỳ tài khoản thật nào được phép kết nối, chủ dự án phải duyệt toàn bộ changeset Rules, chạy emulator và phê duyệt release riêng. Không tự deploy Rules, Indexes, Storage, Functions hoặc đổi project. Chỉ bật flag Family Care thủ công trong .env khi Rules phù hợp đã được phát hành và hai role đã có hồ sơ test.

## Kiểm thử

Chạy tại expo-app/ trong nhánh feature/owner-approved-family-links:

    npm run typecheck && npm run lint && npm test
    npm run test:rules

Lệnh test:rules chạy Firestore Emulator cục bộ, có thể cần Java/Firebase CLI. Nó không deploy gì lên production. **GitHub Actions trên commit `9c4375b4` đã đạt: Node.js 24.12.0, TypeScript, ESLint, 50/50 Jest suites (227/227 tests), và 49/49 Firestore Rules Emulator tests.** Workflow dùng checkout/setup-node/setup-java v5, có báo cáo audit tách toàn cây và production dependencies. Kết quả: https://github.com/thaogiang0405/medicare-ai/actions/runs/45206307339 . Test Rules xác nhận: không link → deny; caregiver tự approve → deny; elderly cấp đúng UID caregiver → allow chỉ đọc thuốc/lịch đang hoạt động; đọc của owner khác hoặc ghi thuốc/lịch → deny; chủ hồ sơ revoke → không đọc tiếp và không thể re-active.

Các test client bổ sung mô phỏng listener Firestore, không sử dụng tài khoản bệnh nhân thật, gồm: kiểm tra link server trước khi đọc, giữ trạng thái tải khi offline/cache, xóa dữ liệu khi revoked, xử lý đổi tài khoản, hủy subscription, cập nhật lịch qua nửa đêm tại Việt Nam, danh sách thuốc đang dùng, lỗi cấu trúc dữ liệu, transaction thu hồi khi offline/đổi Auth và phản hồi danh sách liên kết đến không đúng thứ tự. **Các ca này đã đạt trong GitHub Actions**, nhưng chưa được kiểm tra trên iPhone thật.

## Dependency audit – release gate

- Báo cáo non-blocking trong GitHub Actions cho thấy `npm audit` toàn cây: **27 package advisories (22 moderate, 5 high)**; `npm audit --omit=dev`: **24 (20 moderate, 4 high)**. Các mục high đều quy về cùng dependency gốc `@grpc/grpc-js@1.9.16` được kéo bởi `@firebase/firestore@4.20.0`; `@firebase/rules-unit-testing` là mục high bổ sung chỉ có ở cây dev/test.
- Advisory high [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j) ảnh hưởng `@grpc/grpc-js <1.13.6` và `>=1.14.0 <1.14.5`, bản vá là `1.13.6` / `1.14.5`. Advisory mô tả lỗi xác thực certificate ở một số cấu hình **gRPC server** dùng `getAuthContext`; advisory low liên quan lỗi thông tin trong status message server là [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4).
- Lockfile xác nhận `@firebase/firestore@4.20.0` khai báo `@grpc/grpc-js: ~1.9.0`, cài `1.9.16`. Firebase upstream issue [firebase/firebase-js-sdk#10400](https://github.com/firebase/firebase-js-sdk/issues/10400) ghi nhận pin này; issue vẫn mở và được cập nhật ngày 17-11-2026. npm override thông thường có thể để lại bản 1.9.16 lồng trong Firestore, không bảo đảm thay đúng bản.
- Có dấu hiệu tốt cho Expo runtime: package Firebase Firestore có export riêng `react-native` → `index.rn.js`; [index.rn.ts](https://github.com/firebase/firebase-js-sdk/blob/main/packages/firestore/src/index.rn.ts) và [RN connection.ts](https://github.com/firebase/firebase-js-sdk/blob/main/packages/firestore/src/platform/rn/connection.ts) cho thấy RN dùng browser connection, trong khi [grpc_connection.ts](https://github.com/firebase/firebase-js-sdk/blob/main/packages/firestore/src/platform/node/grpc_connection.ts) là Node transport. Vì vậy audit vẫn thấy dependency trong package tree, nhưng chưa có bằng chứng gRPC Node transport nằm trong bundle Expo Android/iOS. Chưa có kết quả Metro export của chính app để khẳng định điều này tuyệt đối.
- Vì vậy **không tự ép override, downgrade Firebase, hoặc chạy `npm audit fix --force`**. Trước release cần theo dõi bản sửa chính thức từ Firebase và kiểm tra Metro bundle thực tế; giữ cảnh báo trong báo cáo CI cho tới khi upstream xử lý hoặc có phương án tương thích được kiểm thử.

Sau khi Rules được xét duyệt và triển khai có chủ đích, dùng hai tài khoản test riêng (không dùng dữ liệu y tế thật), lần lượt trao đổi UID, approve, xem lịch live, sửa một lịch để kiểm tra thay đổi, revoke để kiểm tra mất quyền, đổi account để kiểm tra xóa dữ liệu.

**CI trên commit `9c4375b4` đã thành công với Node 24.12.0. Chưa kiểm thử luồng hai điện thoại trên Expo Go hoặc thử nghiệm Rules đã triển khai production. PR tiếp tục là Draft; chưa deploy Rules hoặc đổi billing.**

## Kiểm tra Firebase Node transport trong bundle React Native

CI có thêm bước export bundle Android bằng Expo và quét các bundle JavaScript/Hermes
được tạo ra để tìm chữ ký đặc trưng của Node-only Firestore gRPC transport
(`@grpc/grpc-js`, `grpc_connection`, `getAuthContext`). Bước này giúp phân
biệt dependency xuất hiện trong cây npm/npm audit với mã thực sự được đóng gói
cho React Native. Nó không thay thế kiểm tra dependency advisory, không chứng
minh mọi đường thực thi runtime và không phải security certification. Nếu bước
này thất bại, cần xem bundle và Metro resolution trước khi kết luận hoặc thêm
npm override. Không ép phiên bản `@grpc/grpc-js` ngoài range của Firebase SDK.

Bước export dùng cấu hình Expo client hiện có; không deploy Firebase hoặc thay
đổi feature flags trên production.

CI trên commit `9a38c9f` đã export Android thành công và quét **8 bundle JavaScript/Hermes**:
không tìm thấy các chữ ký Node-only nêu trên. Đây là bằng chứng cụ thể từ output Metro
của ứng dụng (không chỉ suy luận từ export map của Firebase). Bước kế tiếp mở rộng kiểm
tra sang iOS và có test riêng cho script audit, gồm trường hợp bundle sạch, thiếu bundle
và từng chữ ký bị chặn. Kết quả của lần mở rộng sẽ được ghi nhận sau khi workflow hoàn tất.


# Family Care: liên kết hai tài khoản có chấp thuận (MVP Spark)

## Trạng thái

Đây là nhánh thử nghiệm riêng từ migration/expo-sdk58, không phải tính năng chia sẻ tin nhắn trong PR #6. Đã có mã nguồn giao diện hai vai trò và Security Rules nhưng **chưa deploy** lên Firebase production và mặc định tắt qua EXPO_PUBLIC_FAMILY_CARE_ENABLED=false.

## Luồng liên kết một chiều

1. Người cao tuổi đăng nhập tài khoản role elderly và bấm **Tạo và chia sẻ mã kết nối**. App tạo document `familyInvites/{inviteCode}` bằng Firestore auto-ID, hết hạn sau khoảng 24 giờ. Mã chỉ định vị một yêu cầu; nó không phải mật khẩu và không cấp quyền đọc sức khỏe.
2. Người chăm sóc đăng nhập tài khoản role caregiver, nhập mã 20 ký tự và bấm **Gửi yêu cầu kết nối**. Một Firestore transaction cập nhật invite `open → claimed` và tạo link `pending` trong cùng thao tác. Mỗi mã chỉ được claim một lần; cùng caregiver có thể retry idempotent nếu phản hồi mạng bị mất.
3. Người cao tuổi tải lại danh sách yêu cầu, kiểm tra tên hiển thị và UID caregiver, rồi chọn **Đồng ý cấp quyền** hoặc **Từ chối yêu cầu**. Approval transaction cập nhật link `pending → active` và invite `claimed → consumed`; rejection cập nhật link/invite thành `rejected`. Rules dùng `getAfter()` để buộc hai document đổi trạng thái nguyên tử.
4. Sau khi owner approve, caregiver dashboard tự phát hiện link qua collection-group query chỉ lọc `caregiverUid == UID đang đăng nhập`, rồi mở listener thuốc/lịch. Không cần caregiver chia sẻ UID ngược lại hoặc owner gửi UID hồ sơ lần thứ hai.
5. Người cao tuổi có thể **Thu hồi quyền** như trước. Link cùng cặp UID đã revoked không thể kích hoạt lại trong MVP. Dữ liệu từng xem/chụp màn hình bên ngoài không thể thu hồi.

Mã mời là locator có entropy cao, không phải credential: biết mã chỉ cho phép gửi một yêu cầu pending. Mọi lần đọc thuốc/lịch vẫn bị Rules từ chối cho đến khi owner duyệt rõ ràng. Owner cần xác minh tên/UID hiển thị với người chăm sóc ngoài đời trước khi đồng ý. Nếu mã bị dùng nhầm, owner từ chối yêu cầu và tạo mã mới.

## Quyền truy cập

- Owner elderly vẫn sở hữu và sửa thuốc/lịch của chính mình.
- Caregiver có quyền **đọc toàn bộ field của document thuốc/lịch đang hoạt động** sau khi được owner cấp quyền, bao gồm hàm lượng và hướng dẫn dùng. Rules chặn đọc thuốc/lịch đã ngừng hoạt động; các truy vấn caregiver bắt buộc lọc `status == active` và `active == true`. Firestore Rules **không thể che riêng từng field khi cho phép đọc document**. UI chỉ trình bày tên thuốc đang dùng và lịch hôm nay. Không có nút sửa, không báo đã uống hoặc đọc DoseEvents. Cần xác minh đúng người nhận và xem lại phạm vi chia sẻ khi duyệt release. Rules vẫn từ chối caregiver đọc DoseEvents/lịch sử, OCR, user profile khác, tạo/chỉnh sửa thuốc và lịch.
- Caregiver chỉ được đọc metadata của các link có `caregiverUid` đúng UID đang đăng nhập, gồm pending/active/revoked/rejected để tự phát hiện yêu cầu và hồ sơ đã kết nối. Collection-group query bắt buộc lọc `caregiverUid`; metadata không chứa dữ liệu sức khỏe. Sau khi revoke, Rules vẫn từ chối mọi lần đọc mới thuốc/lịch. Caregiver không thể tự tạo link pending nếu không claim invite trong cùng transaction, không thể tự approve, cấp thêm quyền hoặc phục hồi link đã revoked.
- Với thao tác đọc trực tiếp một document, Rules xác thực schema đầy đủ và `ownerUid` phải trùng UID ở đường dẫn. Với truy vấn danh sách, query phải ràng buộc `ownerUid` cùng `status == active` hoặc `active == true`; Rules xác thực link và các điều kiện này. Thử thêm schema validator vào `allow list` khiến cả truy vấn hợp lệ bị Emulator từ chối (Rules không thể chứng minh các ràng buộc `keys().hasOnly()`/kiểu dữ liệu qua query), nên không bật cách đó. Firestore vẫn trả toàn bộ document cho caregiver. Trước khi cấp quyền, app owner đọc **từ server** toàn bộ thuốc/lịch active, yêu cầu đúng tập field và kiểu dữ liệu, giới hạn 100 mục; nếu có field lạ/sai schema thì không ghi link. Caregiver cũng kiểm tra lại schema chính xác và ẩn toàn bộ lịch nếu dữ liệu thay đổi bất thường sau khi cấp quyền. Tuy nhiên kiểm tra phía client không thể ngăn raw document được truyền trước khi phát hiện; vì vậy không thêm field nhạy cảm vào hai collection này, và mọi import/Admin SDK phải tuân thủ schema. Muốn giới hạn field thực sự cần projection riêng chỉ chứa dữ liệu caregiver được phép xem.
- Khi chủ hồ sơ tải lại danh sách người được cấp quyền, ứng dụng đọc trực tiếp từ Firestore server, không dùng cache để xác nhận quyền. Chỉ phản hồi mới nhất được dùng để cập nhật danh sách (tránh lần tải cũ ghi đè trạng thái revoked). Thu hồi quyền dùng transaction với revision mới nhất; nếu offline, thao tác thất bại có thông báo và không báo thành công giả. Cấp quyền vẫn phải do chủ hồ sơ xác nhận rõ ràng.
- Dữ liệu đọc trực tuyến chỉ hiển thị sau khi listener nhận xác nhận server; khi quyền bị từ chối hoặc mất kết nối, UI ẩn dữ liệu đã hiển thị. Nếu bất kỳ bản ghi thuốc/lịch đang hoạt động nào có cấu trúc sai, thao tác cấp quyền bị chặn; nếu dữ liệu đổi bất thường sau đó, toàn bộ lịch caregiver bị ẩn và hiện lỗi, không âm thầm bỏ qua một thuốc rồi trình bày lịch thiếu. Tính giờ theo Asia/Ho_Chi_Minh và **tự làm mới lịch dự kiến vào 00:00 giờ Việt Nam** khi màn hình vẫn đang mở. Khi thoát màn hình hoặc quyền bị thu hồi, listener/timer đều phải được ngắt. Màn hình caregiver còn dùng generation token để bỏ qua callback tới muộn từ hồ sơ đã đóng/chuyển, tránh lẫn dữ liệu giữa hai người.

## Miễn phí và an toàn triển khai

Sử dụng Firebase Auth + Firestore trên Spark, không có Cloud Functions, FCM hay dịch vụ trả phí, không tự nâng cấp Billing. Kiểm tra role và liên kết bằng Rules có dùng exists/get, nghĩa là có thêm lượt đọc phụ thuộc và sử dụng quota Firestore miễn phí. Không có đảm bảo chạy vượt quota Spark.

Trước khi bất kỳ tài khoản thật nào được phép kết nối, chủ dự án phải duyệt toàn bộ changeset Rules, chạy emulator và phê duyệt release riêng. Không tự deploy Rules, Indexes, Storage, Functions hoặc đổi project. Chỉ bật flag Family Care thủ công trong .env khi Rules phù hợp đã được phát hành và hai role đã có hồ sơ test.

## Kiểm thử

Chạy tại expo-app/ trong nhánh feature/owner-approved-family-links:

    npm run typecheck && npm run lint && npm test
    npm run test:rules

Lệnh test:rules chạy Firestore Emulator cục bộ, có thể cần Java/Firebase CLI. Nó không deploy gì lên production. **GitHub Actions run #45223627265 trên commit `f47c56a` đã đạt: Node.js 24.12.0, TypeScript, ESLint, 50/50 Jest suites (227/227 tests), 50/50 Firestore Rules Emulator tests, 5/5 test riêng cho bundle audit, và bundle audit Android + iOS (8 bundle mỗi nền tảng).** Kết quả: https://github.com/thaogiang0405/medicare-ai/actions/runs/45223627265 . Test Rules xác nhận: không link → deny; caregiver tự approve → deny; elderly cấp đúng UID caregiver → allow đọc thuốc/lịch active; query không ràng buộc ownerUid hoặc trạng thái → deny; dữ liệu sai owner không lọt vào query; direct get sai schema → deny; ghi thuốc/lịch, DoseEvents và revoke trái phép → deny.

Các test client bổ sung mô phỏng listener Firestore, không sử dụng tài khoản bệnh nhân thật, gồm: kiểm tra link server trước khi đọc, giữ trạng thái tải khi offline/cache, xóa dữ liệu khi revoked, xử lý đổi tài khoản, hủy subscription, cập nhật lịch qua nửa đêm tại Việt Nam, danh sách thuốc đang dùng, lỗi cấu trúc dữ liệu, transaction thu hồi khi offline/đổi Auth và phản hồi danh sách liên kết đến không đúng thứ tự. **Các ca này đã đạt trong GitHub Actions**, nhưng chưa được kiểm tra trên iPhone thật.

## Chuẩn bị Firebase staging an toàn (chưa triển khai)

**Không dùng project production `medicare-ai-cf804` hoặc project Emulator `medicare-ai-rules-test`.** Tạo một Firebase staging project **riêng biệt**, đặt ID chứa `-staging` hoặc `-test`, và dùng gói Spark nếu đáp ứng quota. Trong Firebase Console của project staging, tạo Web App, bật Authentication (phương thức đăng nhập mà app đang dùng) và tạo Firestore. Chỉ khi đã phê duyệt, triển khai bản `firestore.rules` và index collection-group `caregiverLinks` của PR này **vào project staging** bằng quy trình quản trị thủ công; script bên dưới không deploy Rules.

1. Tại thư mục `expo-app/`, sao chép `.env.example` thành `.env` (file này được Git ignore). Điền **đúng Web App config của staging**, không sao chép thông số từ project production. Đặt `EXPO_PUBLIC_FIRESTORE_USER_PROFILES_ENABLED=true`, `EXPO_PUBLIC_FIRESTORE_MEDICATIONS_ENABLED=true`, `EXPO_PUBLIC_FIRESTORE_SCHEDULES_ENABLED=true` và `EXPO_PUBLIC_FAMILY_CARE_ENABLED=true`. Giữ flag OCR/DoseEvents khác theo mục đích kiểm thử, không cần bật cho Family Care.
2. Chạy **kiểm tra không kết nối mạng và không triển khai gì** từ `expo-app/`:

       node scripts/check-family-care-staging.mjs --project <staging-project-id>

   Script chỉ kiểm tra sự khớp project ID được nhập tường minh, loại project production đã biết, tên staging/test, các trường Web App cấu hình, Firebase authDomain/Storage bucket cùng project, bốn flag bắt buộc, và cảnh báo nếu `.env.local` / `.env.development*` hoặc shell ghi đè cấu hình. Nó **không xác minh Rules đã deploy hoặc tài khoản có thật**, cũng không phải bằng chứng dữ liệu an toàn production.
3. Khi preflight PASS **và Rules staging đã được chủ dự án duyệt/triển khai**, mở ứng dụng tại `expo-app/` bằng `npx expo start --clear --lan`, rồi dùng hai tài khoản test trên hai thiết bị. Không chạy lệnh từ thư mục gốc repository vì package Expo nằm trong `expo-app`. Thực hiện checklist dưới đây và ghi PASS/FAIL. Không dùng hồ sơ sức khỏe thật.

Nếu preflight báo BLOCKED thì chỉnh lại cấu hình staging, **không dùng tùy chọn bỏ qua** và không đổi project sang production. Kiểm tra project thực tế trong Firebase Console trước khi đăng nhập hai tài khoản.

## Checklist kiểm thử thủ công hai tài khoản (chưa thực hiện)

Chỉ chạy trên **Firebase staging project riêng**, không dùng production. Cần build Expo với Firebase config trỏ staging và `EXPO_PUBLIC_FAMILY_CARE_ENABLED=true`. Tạo hai tài khoản test độc lập (một elderly, một caregiver), hoàn tất onboarding và dùng dữ liệu giả hoàn toàn; không nhập tên thuốc, hồ sơ hoặc thông tin sức khỏe của người thật. Vì link revoked không thể kích hoạt lại trong MVP, dùng UID test mới cho mỗi lượt chạy.

1. **Tạo mã:** owner elderly tạo và chia sẻ mã mời. Kỳ vọng: mã 20 ký tự, hết hạn khoảng 24 giờ; mã không tự cấp quyền.
2. **Gửi yêu cầu:** caregiver nhập mã và gửi yêu cầu. Kỳ vọng: invite được claim đúng một lần, link chuyển sang pending; caregiver chỉ thấy trạng thái chờ, không đọc được thuốc/lịch.
3. **Owner duyệt:** owner tải lại danh sách, kiểm tra display name/UID, rồi approve hoặc reject. Kỳ vọng: transaction cập nhật link và invite cùng lúc; caregiver không thể tự approve.
4. **Kết nối:** sau approval, hồ sơ tự xuất hiện trên caregiver dashboard qua collection-group query scoped theo caregiver UID. Kỳ vọng: chỉ tên thuốc đang dùng và giờ dự kiến hôm nay xuất hiện; không có nút chỉnh sửa hoặc báo đã uống.
5. **Live update:** owner đổi giờ lịch giả trên A. Kỳ vọng: B nhận giờ mới mà không cần đăng xuất hoặc khởi động lại.
6. **Phạm vi:** thử bằng tài khoản caregiver khác và UID owner khác. Kỳ vọng: không truy cập được. Kiểm thử Emulator đã bao phủ đọc inactive, DoseEvents, OCR, user profile khác và ghi sửa; không dùng dữ liệu thật để thử các trường hợp này.
7. **Thu hồi:** owner revoke trên A. Kỳ vọng: listener metadata link trên B nhận trạng thái `revoked`, tự ngắt listener thuốc/lịch và xóa dữ liệu hiển thị; mọi lần đọc mới thuốc/lịch bị Rules từ chối. UID caregiver cũ không thể tự cấp lại link.
8. **Mất mạng:** khi B offline, không dùng cache để xác nhận link hoặc tiếp tục hiển thị lịch cũ. Khi A offline, approve/revoke phải báo thất bại/chưa hoàn tất; sau khi có mạng mới thử lại.
9. **Đổi tài khoản:** B đăng xuất rồi đăng nhập caregiver khác không có link. Kỳ vọng: không còn bất kỳ tên thuốc/lịch nào của owner trước.
10. **Dọn test:** ghi lại kết quả PASS/FAIL bằng UID giả đã che bớt; reset staging test data theo quy trình quản trị. Không chụp/chia sẻ màn hình chứa hồ sơ sức khỏe thật.

**Điều kiện đạt:** không có dữ liệu trước approve; thay đổi lịch cập nhật live; revoke xóa dữ liệu khỏi UI và chặn đọc mới; offline không tạo thành công giả; đổi tài khoản không làm lộ dữ liệu phiên trước. Chỉ sau khi checklist này và review phạm vi đọc toàn bộ document được chấp thuận mới xem xét bật tính năng cho người dùng thật.

## Dependency audit – release gate

- Báo cáo non-blocking trong GitHub Actions cho thấy `npm audit` toàn cây: **27 package advisories (22 moderate, 5 high)**; `npm audit --omit=dev`: **24 (20 moderate, 4 high)**. Các mục high trong cây production gồm `firebase`, `@firebase/firestore`, `@firebase/firestore-compat` và `@grpc/grpc-js`, cùng liên quan dependency gRPC; `@firebase/rules-unit-testing` là mục high bổ sung ở cây dev/test.
- Advisory high [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j) ảnh hưởng `@grpc/grpc-js <1.13.6` và `>=1.14.0 <1.14.5`, bản vá là `1.13.6` / `1.14.5`. Advisory mô tả lỗi xác thực certificate ở một số cấu hình **gRPC server** dùng `getAuthContext`; advisory low liên quan lỗi thông tin trong status message server là [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4).
- Lockfile xác nhận `@firebase/firestore@4.20.0` khai báo `@grpc/grpc-js: ~1.9.0`, cài `1.9.16`. Firebase upstream issue [firebase/firebase-js-sdk#10400](https://github.com/firebase/firebase-js-sdk/issues/10400) ghi nhận pin này; issue vẫn mở và được cập nhật ngày 17-11-2026. npm override thông thường có thể để lại bản 1.9.16 lồng trong Firestore, không bảo đảm thay đúng bản.
- Có dấu hiệu tốt cho Expo runtime: package Firebase Firestore có export riêng `react-native` → `index.rn.js`; [index.rn.ts](https://github.com/firebase/firebase-js-sdk/blob/main/packages/firestore/src/index.rn.ts) và [RN connection.ts](https://github.com/firebase/firebase-js-sdk/blob/main/packages/firestore/src/platform/rn/connection.ts) cho thấy RN dùng browser connection, trong khi [grpc_connection.ts](https://github.com/firebase/firebase-js-sdk/blob/main/packages/firestore/src/platform/node/grpc_connection.ts) là Node transport. Vì vậy audit vẫn thấy dependency trong package tree. Metro export của ứng dụng đã quét **8 bundle Android và 8 bundle iOS**, không tìm thấy các chữ ký Node-only. Test riêng của script audit cũng xác nhận bundle sạch được chấp nhận, thiếu bundle bị từ chối và cả ba chữ ký Node-only đều bị chặn.
- Vì vậy **không tự ép override, downgrade Firebase, hoặc chạy `npm audit fix --force`**. Trước release cần theo dõi bản sửa chính thức từ Firebase và kiểm tra Metro bundle thực tế; giữ cảnh báo trong báo cáo CI cho tới khi upstream xử lý hoặc có phương án tương thích được kiểm thử.

Sau khi Rules và index được xét duyệt và triển khai có chủ đích lên staging, dùng hai tài khoản test riêng (không dùng dữ liệu y tế thật), lần lượt tạo mã, claim invite, owner approve, kiểm tra caregiver tự thấy hồ sơ và lịch live, sửa một lịch để kiểm tra thay đổi, revoke để kiểm tra mất quyền, đổi account để kiểm tra xóa dữ liệu.

**CI run #45223627265 trên commit `f47c56a` đã thành công: Node 24.12.0, TypeScript, ESLint, 50/50 Jest suites (227/227 tests), 50/50 Rules Emulator tests, 5/5 bundle-audit tests, Android 8/8 bundles và iOS 8/8 bundles. Chưa kiểm thử luồng hai điện thoại trên Expo Go hoặc staging Firebase. PR tiếp tục là Draft; chưa deploy Rules production hoặc đổi billing.**

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

CI trên commit `3781c4e` đã export cả Android và iOS thành công, quét **8 bundle JavaScript/Hermes trên mỗi nền tảng** mà không tìm thấy các chữ ký Node-only nêu trên. Đây là bằng chứng cụ thể từ output Metro của ứng dụng (không chỉ suy luận từ export map của Firebase). Bộ test riêng của script audit đạt **5/5 ca**: bundle sạch, thiếu bundle và ba chữ ký Node-only.


# Kiểm thử bản Expo: OCR bao bì và đọc lịch tiếng Việt

Mốc tích hợp: PR #4, commit `ecbb47c` trên `migration/expo-sdk58`. Người kiểm thử báo `typecheck`, lint và Jest đạt ở bản tích hợp, và ảnh Acetaminophen từng lỗi đã lên thẻ đúng trên iPhone. Phát/dừng giọng đọc được xác nhận trước đó trên nhánh Phase 3; vẫn nên kiểm tra lại hai luồng trong một phiên Expo Go.

## Chạy kiểm tra

Chạy từ `expo-app/`. Nếu vừa cài mới hoặc lockfile đã thay đổi, chạy `npm ci`. Nếu TypeScript báo thiếu route mới sau khi đổi nhánh, mở `npx expo start --go --clear --lan` trước để tạo lại `.expo/types/router.d.ts`, rồi chạy các lệnh dưới đây trong terminal khác.

```cmd
npm run typecheck && npm run lint && npm test
```

## Kiểm tra trên iPhone

1. Mở **Quét vỏ hộp thuốc** và chọn ảnh mẫu Acetaminophen. Kỳ vọng thẻ gợi ý ghi **Acetaminophen 500 mg**, hướng dẫn trống, mục chưa được tích chọn. Thử thêm mẫu Amoxicillin để phát hiện hồi quy. Không lưu kết quả sai hoặc chưa đối chiếu với nhãn.
2. Trên cùng bản app, mở tài khoản thử có lịch thuốc hôm nay. Tắt chế độ im lặng và bấm **Nghe lịch thuốc hôm nay**. Kiểm tra đọc giờ và tên đang hiển thị; thử **Dừng đọc lịch thuốc**, rồi phát lại và rời màn hình. Không được tự ghi nhận đã uống.
3. Thử **Quét đơn thuốc** để kiểm tra luồng OCR cũ vẫn mở, cho phép đối chiếu và không tự lưu.

Jest mô phỏng callback giọng đọc để kiểm tra trạng thái bắt đầu, hết thời gian chờ, dừng và tháo màn hình. Jest không xác nhận âm thanh thực tế, chất lượng phát âm hoặc độ chính xác OCR trên iPhone.

## Theo dõi dependency

Một lần `npm ci` trên Windows từng báo 27 cảnh báo audit, gồm 5 mức cao. Số lượng đó không cho biết gói nào ảnh hưởng bản chạy. Khi phân loại, lấy `npm audit --omit=dev` và `npm audit` rồi kiểm tra đường dẫn dependency trước khi đề xuất nâng cấp tương thích Expo. Không chạy `npm audit fix --force` chỉ để làm sạch cảnh báo.

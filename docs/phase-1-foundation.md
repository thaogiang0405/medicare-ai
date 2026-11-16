# Phase 1 — System Analysis & Foundation

## Mục tiêu đã triển khai

- Khởi tạo Flutter Android (`medicare_ai`) và cấu hình lint mặc định.
- Thiết lập app shell Material 3, giao diện tiếng Việt và token accessibility: vùng chạm tối thiểu 56dp, chữ rõ ràng, biểu tượng kèm nhãn, trạng thái không chỉ dựa vào màu.
- Thêm GoRouter và Riverpod để tách điều hướng/state khỏi widget.
- Tạo entity nền tảng: `AppUser`, `UserRole`, `Medication`, `DoseEvent`, `MedicationStatus`, `DoseStatus`.
- Cài domain repository contract và `Mock*Repository` in-memory, để nhánh UI có hành vi thật trước khi có Firebase.
- Dựng luồng navigation và action có phản hồi cho các màn hình cốt lõi.
- Viết baseline documentation, rules và index design.

## Lý do dữ liệu giả lập

Phase 1 không nên tạo cảm giác một nút đã gọi dịch vụ y tế khi Firebase chưa được cấp cấu hình. `Mock*Repository` lưu dữ liệu trong memory và banner luôn nói rõ điều đó; `Demo*Controller` chỉ chuyển thao tác UI thành lời gọi repository. Ở Phase 2+, thay mock bằng Firebase repository implementation, còn UI vẫn gọi cùng controller/domain boundary.

## Những phần chưa được coi là hoàn thành

- Đăng nhập/đăng ký hiện chỉ validate form rồi vào vai trò trình diễn; chưa xác thực Firebase.
- Các thao tác thêm/ngừng thuốc, dose response và OCR review chỉ thay đổi bộ nhớ; không có persistence/sync.
- Chưa có camera, OCR, TTS, notification, FCM, offline cache hay Cloud Functions.
- Liên kết caregiver chưa tạo mã thật và chưa gửi dữ liệu.
- Security Rules là baseline cần test bằng Emulator trước khi deploy.

## Definition of Done cho Phase 1

- Ứng dụng phân tích tĩnh và widget tests chạy sạch trong môi trường Flutter có toolchain hoàn chỉnh.
- Không còn màn demo counter, placeholder vô nghĩa hoặc secret bị commit.
- Có tài liệu mô tả scope, non-goals, data model, authorization và thứ tự milestone.
- Người đọc source có thể xác định điểm thay thế Firebase mà không phải sửa presentation layer.

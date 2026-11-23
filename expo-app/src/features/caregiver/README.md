# Caregiver – liên kết thật có quyền chỉ xem

Màn hình caregiver không còn giả vờ xem dữ liệu người khác. Khi Family Care đã được duyệt và bật, caregiver gửi UID của mình cho người cao tuổi; elderly xác minh danh tính và phê duyệt trên chính tài khoản của mình, rồi chia sẻ UID chủ hồ sơ để caregiver kết nối xem lịch thuốc live qua Firestore. Quyền bị giới hạn bởi Firestore Rules, có thể revoke vĩnh viễn.

Tính năng đang tắt mặc định, **chưa deploy Rules**, không có quyền xem lịch sử DoseEvent hay ghi dữ liệu. Xem docs/family-care-owner-approved-links.md.

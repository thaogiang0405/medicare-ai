enum UserRole { elderly, caregiver }

extension UserRoleLabels on UserRole {
  String get label => switch (this) {
    UserRole.elderly => 'Người cao tuổi',
    UserRole.caregiver => 'Người chăm sóc',
  };

  String get description => switch (this) {
    UserRole.elderly => 'Xem lịch thuốc, nhận nhắc và tự xác nhận phản hồi.',
    UserRole.caregiver => 'Theo dõi các hồ sơ đã được cấp quyền chia sẻ.',
  };
}

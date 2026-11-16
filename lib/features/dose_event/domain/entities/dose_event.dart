enum DoseStatus { pending, reportedTaken, reportedSkipped, snoozed, unanswered }

extension DoseStatusLabel on DoseStatus {
  String get label => switch (this) {
    DoseStatus.pending => 'Chờ phản hồi',
    DoseStatus.reportedTaken => 'Đã tự báo đã uống',
    DoseStatus.reportedSkipped => 'Đã tự báo bỏ qua',
    DoseStatus.snoozed => 'Đã nhắc lại',
    DoseStatus.unanswered => 'Chưa phản hồi',
  };
}

class DoseEvent {
  const DoseEvent({
    required this.id,
    required this.medicationId,
    required this.scheduledAt,
    required this.status,
    this.respondedAt,
    this.respondedBy,
  });

  final String id;
  final String medicationId;
  final DateTime scheduledAt;
  final DoseStatus status;
  final DateTime? respondedAt;
  final String? respondedBy;

  DoseEvent copyWith({
    DoseStatus? status,
    DateTime? respondedAt,
    String? respondedBy,
  }) {
    return DoseEvent(
      id: id,
      medicationId: medicationId,
      scheduledAt: scheduledAt,
      status: status ?? this.status,
      respondedAt: respondedAt ?? this.respondedAt,
      respondedBy: respondedBy ?? this.respondedBy,
    );
  }
}

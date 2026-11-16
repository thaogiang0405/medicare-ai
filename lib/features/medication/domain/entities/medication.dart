enum MedicationStatus { active, inactive }

extension MedicationStatusLabel on MedicationStatus {
  String get label =>
      this == MedicationStatus.active ? 'Đang sử dụng' : 'Đã ngừng';
}

class Medication {
  const Medication({
    required this.id,
    required this.name,
    required this.strengthText,
    required this.directionsText,
    required this.startDate,
    this.endDate,
    required this.status,
    required this.createdBy,
  });

  final String id;
  final String name;
  final String strengthText;
  final String directionsText;
  final DateTime startDate;
  final DateTime? endDate;
  final MedicationStatus status;
  final String createdBy;

  Medication copyWith({MedicationStatus? status, DateTime? endDate}) {
    return Medication(
      id: id,
      name: name,
      strengthText: strengthText,
      directionsText: directionsText,
      startDate: startDate,
      endDate: endDate ?? this.endDate,
      status: status ?? this.status,
      createdBy: createdBy,
    );
  }
}

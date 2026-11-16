import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/medication.dart';
import '../../domain/repositories/medication_repository.dart';

/// In-memory data source for Phase 1. It lets screens demonstrate the intended
/// UI without pretending that health data has been persisted remotely.
class MockMedicationRepository implements MedicationRepository {
  MockMedicationRepository({DateTime Function()? clock})
    : _clock = clock ?? DateTime.now {
    _medications = _seed(_clock());
  }

  final DateTime Function() _clock;
  late List<Medication> _medications;

  @override
  List<Medication> getAll() => List.unmodifiable(_medications);

  @override
  Medication add({
    required String name,
    required String strengthText,
    required String directionsText,
    required String createdBy,
  }) {
    final now = _clock();
    final medication = Medication(
      id: 'manual-${now.microsecondsSinceEpoch}',
      name: name.trim(),
      strengthText: strengthText.trim(),
      directionsText: directionsText.trim(),
      startDate: DateTime(now.year, now.month, now.day),
      status: MedicationStatus.active,
      createdBy: createdBy,
    );
    _medications = [..._medications, medication];
    return medication;
  }

  @override
  void deactivate(String medicationId) {
    final now = _clock();
    _medications = [
      for (final medication in _medications)
        if (medication.id == medicationId)
          medication.copyWith(status: MedicationStatus.inactive, endDate: now)
        else
          medication,
    ];
  }

  static List<Medication> _seed(DateTime now) {
    return [
      Medication(
        id: 'metformin-500',
        name: 'Metformin',
        strengthText: '500 mg',
        directionsText: 'Uống theo hướng dẫn đã được kiểm tra.',
        startDate: DateTime(now.year, now.month, 1),
        status: MedicationStatus.active,
        createdBy: 'demo-elderly',
      ),
      Medication(
        id: 'amlodipine-5',
        name: 'Amlodipine',
        strengthText: '5 mg',
        directionsText: 'Uống theo hướng dẫn đã được kiểm tra.',
        startDate: DateTime(now.year, now.month, 1),
        status: MedicationStatus.active,
        createdBy: 'demo-elderly',
      ),
    ];
  }
}

final medicationRepositoryProvider = Provider<MedicationRepository>(
  (ref) => MockMedicationRepository(),
);

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/repositories/mock_medication_repository.dart';
import '../../domain/entities/medication.dart';

final demoMedicationsProvider =
    NotifierProvider<DemoMedicationsController, List<Medication>>(
      DemoMedicationsController.new,
    );

class DemoMedicationsController extends Notifier<List<Medication>> {
  @override
  List<Medication> build() => ref.read(medicationRepositoryProvider).getAll();

  void addMedication({
    required String name,
    required String strengthText,
    required String directionsText,
    required String createdBy,
  }) {
    final repository = ref.read(medicationRepositoryProvider);
    repository.add(
      name: name,
      strengthText: strengthText,
      directionsText: directionsText,
      createdBy: createdBy,
    );
    state = repository.getAll();
  }

  void deactivate(String medicationId) {
    final repository = ref.read(medicationRepositoryProvider);
    repository.deactivate(medicationId);
    state = repository.getAll();
  }
}

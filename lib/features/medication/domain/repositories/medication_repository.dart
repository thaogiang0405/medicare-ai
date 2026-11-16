import '../entities/medication.dart';

/// Contract for medication persistence. The real Firebase implementation must
/// preserve historical records rather than deleting a medication in place.
abstract interface class MedicationRepository {
  List<Medication> getAll();

  Medication add({
    required String name,
    required String strengthText,
    required String directionsText,
    required String createdBy,
  });

  void deactivate(String medicationId);
}

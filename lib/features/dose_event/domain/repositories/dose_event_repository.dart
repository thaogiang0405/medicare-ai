import '../entities/dose_event.dart';

/// Contract for immutable dose-event history and response recording.
abstract interface class DoseEventRepository {
  List<DoseEvent> getAll();

  void recordResponse({
    required String eventId,
    required DoseStatus status,
    required String respondedBy,
  });
}

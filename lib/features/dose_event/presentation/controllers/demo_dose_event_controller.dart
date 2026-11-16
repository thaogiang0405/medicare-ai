import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/repositories/mock_dose_event_repository.dart';
import '../../domain/entities/dose_event.dart';

final demoDoseEventsProvider =
    NotifierProvider<DemoDoseEventsController, List<DoseEvent>>(
      DemoDoseEventsController.new,
    );

class DemoDoseEventsController extends Notifier<List<DoseEvent>> {
  @override
  List<DoseEvent> build() => ref.read(doseEventRepositoryProvider).getAll();

  void recordResponse(String eventId, DoseStatus status) {
    final repository = ref.read(doseEventRepositoryProvider);
    repository.recordResponse(
      eventId: eventId,
      status: status,
      respondedBy: 'demo-elderly',
    );
    state = repository.getAll();
  }
}

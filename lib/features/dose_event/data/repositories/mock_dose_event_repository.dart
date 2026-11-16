import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/dose_event.dart';
import '../../domain/repositories/dose_event_repository.dart';

/// Local-only schedule response store used until Firestore dose events exist.
class MockDoseEventRepository implements DoseEventRepository {
  MockDoseEventRepository({DateTime Function()? clock})
    : _clock = clock ?? DateTime.now {
    _events = _seed(_clock());
  }

  final DateTime Function() _clock;
  late List<DoseEvent> _events;

  @override
  List<DoseEvent> getAll() => List.unmodifiable(_events);

  @override
  void recordResponse({
    required String eventId,
    required DoseStatus status,
    required String respondedBy,
  }) {
    final now = _clock();
    _events = [
      for (final event in _events)
        if (event.id == eventId)
          event.copyWith(
            status: status,
            respondedAt: now,
            respondedBy: respondedBy,
          )
        else
          event,
    ];
  }

  static List<DoseEvent> _seed(DateTime now) {
    final today = DateTime(now.year, now.month, now.day);
    return [
      DoseEvent(
        id: 'metformin-${today.millisecondsSinceEpoch}',
        medicationId: 'metformin-500',
        scheduledAt: today.add(const Duration(hours: 8)),
        status: DoseStatus.pending,
      ),
      DoseEvent(
        id: 'amlodipine-${today.millisecondsSinceEpoch}',
        medicationId: 'amlodipine-5',
        scheduledAt: today.add(const Duration(hours: 20)),
        status: DoseStatus.pending,
      ),
    ];
  }
}

final doseEventRepositoryProvider = Provider<DoseEventRepository>(
  (ref) => MockDoseEventRepository(),
);

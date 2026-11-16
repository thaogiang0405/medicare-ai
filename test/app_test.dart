import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:medicare_ai/app/app.dart';
import 'package:medicare_ai/app/firebase_initialization_failure_app.dart';
import 'package:medicare_ai/features/medication/data/repositories/mock_medication_repository.dart';
import 'package:medicare_ai/features/medication/domain/entities/medication.dart';
import 'package:medicare_ai/features/dose_event/domain/entities/dose_event.dart';
import 'package:medicare_ai/features/dose_event/presentation/controllers/demo_dose_event_controller.dart';

void main() {
  testWidgets('starts with the MediCare AI splash screen', (tester) async {
    await tester.pumpWidget(ProviderScope(child: const MediCareApp()));

    expect(find.text('MediCare AI'), findsOneWidget);
    expect(
      find.text('Trợ lý quản lý thuốc và chăm sóc người cao tuổi'),
      findsOneWidget,
    );

    await tester.pumpAndSettle();
    expect(find.text('Quản lý thuốc nhẹ nhàng, rõ ràng'), findsOneWidget);
  });

  testWidgets('navigates from login to role selection', (tester) async {
    await tester.pumpWidget(ProviderScope(child: const MediCareApp()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Bắt đầu'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byType(TextFormField).at(0),
      'minh@example.com',
    );
    await tester.enterText(find.byType(TextFormField).at(1), 'matkhau');
    await tester.tap(find.text('Tiếp tục'));
    await tester.pumpAndSettle();

    expect(find.text('Chọn vai trò'), findsOneWidget);
    expect(find.text('Người cao tuổi'), findsOneWidget);
    expect(find.text('Người chăm sóc'), findsOneWidget);
  });

  testWidgets('shows a clear Firebase initialization failure state', (
    tester,
  ) async {
    await tester.pumpWidget(
      FirebaseInitializationFailureApp(error: StateError('test')),
    );

    expect(find.text('Không thể khởi tạo Firebase'), findsOneWidget);
    expect(find.textContaining('Kiểm tra kết nối mạng'), findsOneWidget);
  });

  test('dose response is recorded against the deterministic demo event', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final event = container.read(demoDoseEventsProvider).first;

    container
        .read(demoDoseEventsProvider.notifier)
        .recordResponse(event.id, DoseStatus.reportedTaken);

    final updated = container
        .read(demoDoseEventsProvider)
        .firstWhere((candidate) => candidate.id == event.id);
    expect(updated.status, DoseStatus.reportedTaken);
    expect(updated.respondedBy, 'demo-elderly');
    expect(updated.respondedAt, isNotNull);
  });

  test('mock medication repository soft-deactivates a created medication', () {
    final clock = DateTime(2026, 11, 16, 9);
    final repository = MockMedicationRepository(clock: () => clock);

    final created = repository.add(
      name: 'Vitamin D',
      strengthText: '1,000 IU',
      directionsText: 'Theo đơn đã kiểm tra',
      createdBy: 'demo-elderly',
    );
    repository.deactivate(created.id);

    final saved = repository.getAll().firstWhere(
      (medication) => medication.id == created.id,
    );
    expect(saved.status, MedicationStatus.inactive);
    expect(saved.endDate, clock);
  });
}

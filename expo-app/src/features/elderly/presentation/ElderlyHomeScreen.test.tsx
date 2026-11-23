/* eslint-disable import/first */

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock('@/services/firebase/family-care-feature', () => ({
  isFamilyCareFeatureEnabled: () => false,
}));

// The family-link panel is feature-gated off here; do not import its
// Firebase/AsyncStorage runtime while exercising the elderly dashboard.
jest.mock('@/features/family-care/presentation/FamilyLinkOwnerPanel', () => ({
  FamilyLinkOwnerPanel: () => null,
}));

jest.mock('./TodayScheduleSpeechButton', () => ({
  TodayScheduleSpeechButton: () => null,
}));

jest.mock('@/components/medicare', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    Screen: ({ children }: { children?: import('react').ReactNode }) => React.createElement(View, null, children),
    AppHeader: ({ title }: { title: string }) => React.createElement(Text, null, title),
    DemoModeBanner: ({ title, description }: { title: string; description: string }) =>
      React.createElement(View, null, React.createElement(Text, null, title), React.createElement(Text, null, description)),
    DoseEventCard: ({ medicationName }: { medicationName: string }) =>
      React.createElement(View, { testID: 'demo-dose-event' }, React.createElement(Text, null, `DoseEvent: ${medicationName}`), React.createElement(Text, null, 'Đã uống')),
    MedicationScheduleCard: ({
      localTime,
      medicationName,
      recurrenceText,
      doseStatus,
      responseActions,
      testID,
    }: {
      localTime: string;
      medicationName: string;
      recurrenceText: string;
      doseStatus?: string;
      responseActions?: { onReportTaken: () => void; onReportSkipped: () => void };
      testID?: string;
    }) => React.createElement(
      View,
      { testID },
      React.createElement(Text, null, `${localTime} ${medicationName} ${recurrenceText}`),
      React.createElement(Text, null, doseStatus ? `Dose status: ${doseStatus}` : 'Lịch dự kiến – Chưa ghi nhận uống'),
      responseActions ? React.createElement(Pressable, { accessibilityLabel: 'Đã uống', onPress: responseActions.onReportTaken }, React.createElement(Text, null, 'Đã uống')) : null,
      responseActions ? React.createElement(Pressable, { accessibilityLabel: 'Bỏ qua', onPress: responseActions.onReportSkipped }, React.createElement(Text, null, 'Bỏ qua')) : null,
    ),
    SafetyNotice: ({ title, message }: { title: string; message: string }) =>
      React.createElement(View, null, React.createElement(Text, null, title), React.createElement(Text, null, message)),
    ActionCard: ({ title, onPress }: { title: string; onPress: () => void }) =>
      React.createElement(Pressable, { accessibilityLabel: title, onPress }, React.createElement(Text, null, title)),
    SecondaryButton: ({ label, onPress }: { label: string; onPress: () => void }) =>
      React.createElement(Pressable, { accessibilityLabel: label, onPress }, React.createElement(Text, null, label)),
  };
});

jest.mock('@/store', () => ({
  useSessionStore: jest.fn(),
}));

jest.mock('./useElderlyDashboard', () => ({
  useElderlyDashboard: jest.fn(),
}));

import { router } from 'expo-router';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';
import type { DoseEvent, Medication, MedicationSchedule } from '@/types/domain';
import { useSessionStore } from '@/store';

import ElderlyHomeScreen from './ElderlyHomeScreen';
import { useElderlyDashboard } from './useElderlyDashboard';

const sessionState = {
  signOut: jest.fn(),
  operationStatus: 'idle' as const,
  errorMessage: null,
};

const medication: Medication = {
  id: 'med-1',
  name: 'Metformin thật',
  strengthText: '500 mg',
  directionsText: 'Theo hướng dẫn đã nhập',
  status: 'active',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const schedule: MedicationSchedule = {
  id: 'schedule-1',
  medicationId: medication.id,
  recurrence: 'daily',
  localTime: '08:00',
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  startDate: '2026-11-01',
  endDate: null,
  timeZone: 'Asia/Ho_Chi_Minh',
  active: true,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
};

const demoEvent: DoseEvent = {
  id: 'demo-dose-1',
  medicationId: medication.id,
  scheduledAt: '2026-11-23T01:00:00.000Z',
  status: 'pending',
};

const retryDashboard = jest.fn();

function mockDashboard(overrides: Record<string, unknown> = {}) {
  jest.mocked(useElderlyDashboard).mockReturnValue({
    user: { id: 'elderly-a', displayName: 'Cô Minh', role: 'elderly', isAuthenticated: true },
    dashboardMode: 'firestore-schedules',
    medicationsFeatureEnabled: true,
    schedulesFeatureEnabled: true,
    doseEventsFeatureEnabled: false,
    localRemindersFeatureEnabled: false,
    localReminderStatus: 'disabled',
    usesFirestoreDoseTracking: false,
    doses: [],
    medicationSchedules: [{ schedule, medication }],
    doseTrackingSchedules: [],
    isLoading: false,
    errorMessage: null,
    retryDashboard,
    recordResponse: undefined,
    recordDoseResponse: undefined,
    isRecordingDoseResponse: false,
    enableLocalReminders: jest.fn(),
    ...overrides,
  } as ReturnType<typeof useElderlyDashboard>);
}

describe('ElderlyHomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSessionStore as unknown as jest.Mock).mockImplementation((selector: (state: typeof sessionState) => unknown) => selector(sessionState));
    mockDashboard();
  });

  it('renders planned Firestore schedules without mixing demo DoseEvent actions', async () => {
    const view = await render(<ElderlyHomeScreen />);

    expect(view.getByTestId('medication-schedule-schedule-1')).toBeOnTheScreen();
    expect(view.getByText('Lịch dự kiến – Chưa ghi nhận uống')).toBeOnTheScreen();
    expect(view.queryByTestId('demo-dose-event')).toBeNull();
    expect(view.queryByText('Đã uống')).toBeNull();
  });

  it('keeps demo DoseEvents separate when either Firestore dependency is disabled', async () => {
    mockDashboard({
      dashboardMode: 'demo',
      medicationsFeatureEnabled: true,
      schedulesFeatureEnabled: false,
      doses: [{ event: demoEvent, medication }],
      medicationSchedules: [{ schedule, medication }],
      recordResponse: jest.fn(),
    });

    const view = await render(<ElderlyHomeScreen />);

    expect(view.getByTestId('demo-dose-event')).toBeOnTheScreen();
    expect(view.getByText('Đã uống')).toBeOnTheScreen();
    expect(view.queryByTestId('medication-schedule-schedule-1')).toBeNull();
  });

  it('shows empty and error states with a retry that does not expose dose actions', async () => {
    mockDashboard({ medicationSchedules: [] });
    const view = await render(<ElderlyHomeScreen />);

    expect(view.getByText('Chưa có lịch thuốc hôm nay')).toBeOnTheScreen();

    mockDashboard({ medicationSchedules: [], errorMessage: 'Không thể tải lịch từ Firebase.' });
    await view.rerender(<ElderlyHomeScreen />);

    expect(view.getByText('Không thể tải lịch thuốc')).toBeOnTheScreen();
    await fireEvent.press(view.getByLabelText('Thử tải lại lịch thuốc'));
    expect(retryDashboard).toHaveBeenCalledTimes(1);
    expect(view.queryByTestId('demo-dose-event')).toBeNull();
  });

  it('shows real self-report actions only when M3.4 dose tracking is enabled', async () => {
    const recordDoseResponse = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockDashboard({
      usesFirestoreDoseTracking: true,
      doseEventsFeatureEnabled: true,
      medicationSchedules: [],
      doseTrackingSchedules: [{
        schedule,
        medication,
        event: null,
        priorResponseEvent: null,
        eventId: 'schedule-1__2026-11-23__08:00',
        scheduledLocalDate: '2026-11-23',
        scheduledAt: '2026-11-23T01:00:00.000Z',
        status: 'pending',
        canRespond: true,
      }],
      recordDoseResponse,
    });

    const view = await render(<ElderlyHomeScreen />);

    expect(view.getByTestId('dose-tracking-schedule-schedule-1')).toBeOnTheScreen();
    await fireEvent.press(view.getByLabelText('Đã uống'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Xác nhận phản hồi tự báo',
      expect.stringContaining('sẽ được lưu một lần'),
      expect.any(Array),
      expect.objectContaining({ cancelable: true }),
    );
    expect(recordDoseResponse).not.toHaveBeenCalled();

    await fireEvent.press(view.getByLabelText('Đã uống'));
    expect(alertSpy).toHaveBeenCalledTimes(1);

    const confirmationButtons = alertSpy.mock.calls[0]?.[2];
    // The Alert callback is invoked manually by this test rather than by
    // React Native's event system; flush its asynchronous cleanup inside act.
    await act(async () => {
      confirmationButtons?.find((button) => button.text === 'Đã uống')?.onPress?.();
      await Promise.resolve();
    });
    expect(recordDoseResponse).toHaveBeenCalledWith(expect.objectContaining({ schedule, medication }), 'reportedTaken');
    expect(view.queryByTestId('demo-dose-event')).toBeNull();
    alertSpy.mockRestore();
  });

  it('offers protected elderly navigation to response history and device reminder settings', async () => {
    const view = await render(<ElderlyHomeScreen />);

    await fireEvent.press(view.getByLabelText('Lịch sử uống thuốc'));
    await fireEvent.press(view.getByLabelText('Cài đặt nhắc lịch'));

    expect(router.push).toHaveBeenCalledWith('/elderly/dose-history');
    expect(router.push).toHaveBeenCalledWith('/elderly/reminder-settings');
  });

  it('offers the protected prescription review route from the elderly home', async () => {
    const view = await render(<ElderlyHomeScreen />);

    await fireEvent.press(view.getByLabelText('Quét đơn thuốc'));

    expect(router.push).toHaveBeenCalledWith('/elderly/prescription-ocr');
  });

  it('offers the separate safe package-label OCR route', async () => {
    const view = await render(<ElderlyHomeScreen />);
    await fireEvent.press(view.getByLabelText('Quét vỏ hộp thuốc'));
    expect(router.push).toHaveBeenCalledWith('/elderly/medication-package');
  });
});

/* eslint-disable import/first */

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

jest.mock('@/components/medicare', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } = jest.requireActual<typeof import('react-native')>('react-native');

  return {
    Screen: ({ children, testID }: { children?: import('react').ReactNode; testID?: string }) =>
      React.createElement(View, { testID }, children),
    AppHeader: ({ title }: { title: string }) => React.createElement(Text, null, title),
    DemoModeBanner: ({ title, description }: { title: string; description: string }) =>
      React.createElement(View, null, React.createElement(Text, null, title), React.createElement(Text, null, description)),
    PrimaryButton: ({
      label,
      onPress,
      testID,
    }: {
      label: string;
      onPress: () => void;
      testID?: string;
    }) => React.createElement(Pressable, { accessibilityLabel: label, onPress, testID }, React.createElement(Text, null, label)),
    SafetyNotice: ({ title, message }: { title: string; message: string }) =>
      React.createElement(View, null, React.createElement(Text, null, title), React.createElement(Text, null, message)),
    StatusBadge: ({ status }: { status: 'active' | 'inactive' }) =>
      React.createElement(Text, null, status === 'active' ? 'Đang sử dụng' : 'Đã ngừng sử dụng'),
    TextField: ({ label }: { label: string }) => React.createElement(Text, null, label),
  };
});

jest.mock('./useMedicationManagement', () => ({
  useMedicationManagement: jest.fn(),
}));

import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { Medication } from '@/types/domain';

import MedicationListScreen from './MedicationListScreen';
import { useMedicationManagement } from './useMedicationManagement';

const activeMedication: Medication = {
  id: 'med-active',
  name: 'Metformin',
  strengthText: '500 mg',
  directionsText: 'Nội dung đã ghi nhận',
  status: 'active',
  createdAt: '2026-11-18T00:00:00.000Z',
  updatedAt: '2026-11-18T00:00:00.000Z',
};

const inactiveMedication: Medication = {
  ...activeMedication,
  id: 'med-inactive',
  name: 'Amlodipine',
  status: 'inactive',
};

const reload = jest.fn();

function mockMedicationManagement(overrides: Record<string, unknown> = {}) {
  jest.mocked(useMedicationManagement).mockReturnValue({
    user: { id: 'elderly-a', displayName: 'Cô Minh', role: 'elderly', isAuthenticated: true },
    activeUserId: 'elderly-a',
    medications: [activeMedication, inactiveMedication],
    listStatus: 'ready',
    operationStatus: 'idle',
    errorMessage: null,
    reload,
    createMedication: jest.fn(),
    updateMedication: jest.fn(),
    markMedicationInactive: jest.fn(),
    clearError: jest.fn(),
    ...overrides,
  } as ReturnType<typeof useMedicationManagement>);
}

describe('MedicationListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMedicationManagement();
  });

  it('renders a high-legibility medication list with accessible status filter controls', async () => {
    const view = await render(<MedicationListScreen />);

    expect(view.getByText('Metformin')).toBeOnTheScreen();
    expect(view.getByText('Đang sử dụng')).toBeOnTheScreen();
    expect(view.getByText('Đã ngừng sử dụng')).toBeOnTheScreen();
    expect(view.getByRole('radio', { name: 'Lọc: Tất cả' }).props.accessibilityState).toEqual({ selected: true });
    expect(view.getByRole('radio', { name: 'Lọc: Đang dùng' }).props.accessibilityState).toEqual({ selected: false });
    expect(view.getByRole('radio', { name: 'Lọc: Đã ngừng' }).props.accessibilityState).toEqual({ selected: false });
  });

  it('shows an empty state and lets the user open the add-medication form', async () => {
    mockMedicationManagement({ medications: [] });
    const view = await render(<MedicationListScreen />);

    expect(view.getByText('Chưa có thuốc nào')).toBeOnTheScreen();
    await fireEvent.press(view.getByTestId('add-medication-button'));

    expect(router.push).toHaveBeenCalledWith('/elderly/medications/new');
  });
});

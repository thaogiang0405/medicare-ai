/* eslint-disable import/first */

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/store', () => ({ useSessionStore: jest.fn() }));
jest.mock('@/services/firebase/family-care-feature', () => ({
  isFamilyCareFeatureEnabled: () => false,
}));
jest.mock('@/services/firebase', () => ({ getFirebaseAuth: jest.fn() }));
jest.mock('@/components/medicare', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } = jest.requireActual<typeof import('react-native')>('react-native');
  const button = ({ label, onPress }: { label: string; onPress: () => void }) =>
    React.createElement(Pressable, { accessibilityLabel: label, onPress }, React.createElement(Text, null, label));
  return {
    Screen: ({ children }: { children: import('react').ReactNode }) => React.createElement(View, null, children),
    AppHeader: ({ title }: { title: string }) => React.createElement(Text, null, title),
    SafetyNotice: ({ title, message }: { title: string; message: string }) =>
      React.createElement(View, null, React.createElement(Text, null, title), React.createElement(Text, null, message)),
    PrimaryButton: button,
    SecondaryButton: button,
    TextField: () => null,
  };
});

import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useSessionStore } from '@/store';
import CaregiverDashboardScreen from './CaregiverDashboardScreen';

const session = {
  user: { id: 'caregiver-a', role: 'caregiver' as const, displayName: 'Người chăm sóc' },
  signOut: jest.fn().mockResolvedValue(undefined),
  operationStatus: 'idle' as const,
  errorMessage: null,
};

describe('CaregiverDashboardScreen safe default', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSessionStore as unknown as jest.Mock).mockImplementation(
      (selector: (state: typeof session) => unknown) => selector(session),
    );
  });

  it('never invents shared health data or opens Firestore while feature is disabled', async () => {
    const view = await render(<CaregiverDashboardScreen />);
    expect(view.getByText('Liên kết hồ sơ chưa được kích hoạt')).toBeTruthy();
    expect(view.queryByText('Hồ sơ minh họa')).toBeNull();
    expect(view.queryByText('Thuốc mẫu A')).toBeNull();
    expect(view.queryByText('Theo dõi lịch thuốc')).toBeNull();
  });

  it('retains sign-out behavior', async () => {
    const view = await render(<CaregiverDashboardScreen />);
    await fireEvent.press(view.getByLabelText('Đăng xuất'));
    expect(session.signOut).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/login');
  });
});

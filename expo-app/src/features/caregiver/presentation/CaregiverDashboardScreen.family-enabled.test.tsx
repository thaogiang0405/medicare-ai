/* eslint-disable import/first */

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/store', () => ({ useSessionStore: jest.fn() }));
jest.mock('@/services/firebase/family-care-feature', () => ({ isFamilyCareFeatureEnabled: () => true }));
jest.mock('@/features/family-care/data/family-link-repository', () => ({
  requestCaregiverLink: jest.fn(),
  watchCaregiverConnections: jest.fn(),
  watchCaregiverPlans: jest.fn(),
}));
jest.mock('@/components/medicare', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, TextInput, View } = jest.requireActual<typeof import('react-native')>('react-native');
  const button = ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) =>
    React.createElement(Pressable, { accessibilityLabel: label, onPress, disabled }, React.createElement(Text, null, label));
  return {
    Screen: ({ children }: { children: import('react').ReactNode }) => React.createElement(View, null, children),
    AppHeader: ({ title }: { title: string }) => React.createElement(Text, null, title),
    SafetyNotice: ({ title, message }: { title: string; message: string }) =>
      React.createElement(View, null, React.createElement(Text, null, title), React.createElement(Text, null, message)),
    SecondaryButton: button,
    TextField: ({ label, onChangeText, value }: { label: string; onChangeText: (value: string) => void; value: string }) =>
      React.createElement(TextInput, { accessibilityLabel: label, onChangeText, value }),
  };
});

import { act, fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useSessionStore } from '@/store';
import {
  requestCaregiverLink, watchCaregiverConnections, watchCaregiverPlans,
  type CaregiverConnectionsResult, type CaregiverScheduleResult,
} from '@/features/family-care/data/family-link-repository';
import CaregiverDashboardScreen from './CaregiverDashboardScreen';

const session = {
  user: { id: 'caregiver-123', displayName: 'Người chăm sóc', role: 'caregiver' as const },
  signOut: jest.fn().mockResolvedValue(undefined),
  operationStatus: 'idle' as const,
  errorMessage: null,
};
const stopConnections = jest.fn();
const stopPlans = jest.fn();
let deliverConnections: ((value: CaregiverConnectionsResult) => void) | null = null;
let deliverPlans: ((value: CaregiverScheduleResult) => void) | null = null;

describe('one-code caregiver Family Care flow', () => {
  beforeEach(() => {
    session.user.id = 'caregiver-123';
    deliverConnections = null;
    deliverPlans = null;
    jest.clearAllMocks();
    (useSessionStore as unknown as jest.Mock).mockImplementation(
      (selector: (state: typeof session) => unknown) => selector(session),
    );
    jest.mocked(requestCaregiverLink).mockResolvedValue(undefined);
    jest.mocked(watchCaregiverConnections).mockImplementation((_uid, onChange) => {
      deliverConnections = onChange;
      onChange({ status: 'loading', connections: [] });
      return stopConnections;
    });
    jest.mocked(watchCaregiverPlans).mockImplementation((_caregiverUid, _ownerUid, onChange) => {
      deliverPlans = onChange;
      onChange({ status: 'loading', plans: [] });
      return stopPlans;
    });
  });

  it('discovers requests and active links automatically without asking for an elderly UID', async () => {
    const view = await render(<CaregiverDashboardScreen />);
    expect(watchCaregiverConnections).toHaveBeenCalledWith('caregiver-123', expect.any(Function));
    expect(view.getByLabelText('Mã mời từ người cao tuổi')).toBeTruthy();
    expect(view.queryByLabelText('Mã hồ sơ người cao tuổi')).toBeNull();
    expect(view.queryByLabelText('Chia sẻ mã người chăm sóc')).toBeNull();
    expect(watchCaregiverPlans).not.toHaveBeenCalled();
  });

  it('submits one invitation code and waits for owner approval', async () => {
    const view = await render(<CaregiverDashboardScreen />);
    await fireEvent.changeText(view.getByLabelText('Mã mời từ người cao tuổi'), 'AbCdEfGhIjKlMnOpQrSt');
    await fireEvent.press(view.getByLabelText('Gửi yêu cầu kết nối'));
    expect(requestCaregiverLink).toHaveBeenCalledWith('caregiver-123', 'AbCdEfGhIjKlMnOpQrSt');
    expect(await view.findByText('Đã gửi yêu cầu')).toBeTruthy();
    expect(view.getByText('Đã gửi yêu cầu. Chờ người cao tuổi kiểm tra danh tính và xác nhận; bạn chưa được xem dữ liệu.')).toBeTruthy();
  });

  it('shows pending requests without starting a health-data listener', async () => {
    const view = await render(<CaregiverDashboardScreen />);
    await act(async () => {
      deliverConnections?.({ status: 'ready', connections: [{
        ownerUid: 'elderly-123', ownerDisplayName: 'Nguyễn Văn A', status: 'pending', revision: 1,
      }] });
    });
    expect(view.getByText('Nguyễn Văn A')).toBeTruthy();
    expect(view.getByText('Đang chờ người cao tuổi xác nhận. Bạn chưa có quyền xem thuốc hoặc lịch.')).toBeTruthy();
    expect(watchCaregiverPlans).not.toHaveBeenCalled();
  });

  it('automatically opens the linked profile after owner approval and renders read-only plans', async () => {
    const view = await render(<CaregiverDashboardScreen />);
    await act(async () => {
      deliverConnections?.({ status: 'ready', connections: [{
        ownerUid: 'elderly-123', ownerDisplayName: 'Nguyễn Văn A', status: 'active', revision: 2,
      }] });
    });
    expect(watchCaregiverPlans).toHaveBeenCalledWith('caregiver-123', 'elderly-123', expect.any(Function));
    await act(async () => {
      deliverPlans?.({ status: 'ready', plans: [{ time: '08:00', medicationName: 'Metformin' }], medicationNames: ['Metformin'] });
    });
    expect(view.getByText('Nguyễn Văn A · Chỉ xem')).toBeTruthy();
    expect(view.getByText('08:00 · Metformin')).toBeTruthy();
    expect(view.queryByLabelText('Chỉnh sửa thuốc')).toBeNull();
    expect(view.queryByLabelText('Đã uống')).toBeNull();
  });

  it('hides health data and stops the listener immediately when owner revokes access', async () => {
    const view = await render(<CaregiverDashboardScreen />);
    await act(async () => {
      deliverConnections?.({ status: 'ready', connections: [{
        ownerUid: 'elderly-123', ownerDisplayName: 'Nguyễn Văn A', status: 'active', revision: 2,
      }] });
    });
    await act(async () => {
      deliverPlans?.({ status: 'ready', plans: [{ time: '08:00', medicationName: 'Private medicine' }] });
    });
    expect(view.getByText('08:00 · Private medicine')).toBeTruthy();
    await act(async () => {
      deliverConnections?.({ status: 'ready', connections: [{
        ownerUid: 'elderly-123', ownerDisplayName: 'Nguyễn Văn A', status: 'revoked', revision: 3,
      }] });
    });
    expect(view.queryByText('08:00 · Private medicine')).toBeNull();
    expect(view.getByText('Quyền xem đã bị thu hồi.')).toBeTruthy();
    expect(stopPlans).toHaveBeenCalled();
  });

  it('unsubscribes connection discovery before signing out', async () => {
    const view = await render(<CaregiverDashboardScreen />);
    await fireEvent.press(view.getByLabelText('Đăng xuất'));
    expect(stopConnections).toHaveBeenCalled();
    expect(session.signOut).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/login');
  });
});

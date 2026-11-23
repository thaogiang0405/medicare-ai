/* eslint-disable import/first */

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/store', () => ({ useSessionStore: jest.fn() }));
jest.mock('@/services/firebase/family-care-feature', () => ({
  isFamilyCareFeatureEnabled: () => true,
}));
jest.mock('@/services/firebase', () => ({ getFirebaseAuth: jest.fn() }));
jest.mock('@/features/family-care/data/family-link-repository', () => ({
  watchCaregiverPlans: jest.fn(),
  validateFamilyUid: jest.fn((value: string) => {
    const uid = value.trim();
    if (!/^[A-Za-z0-9_-]{6,128}$/.test(uid)) throw new Error('Invalid UID');
    return uid;
  }),
}));
jest.mock('@/components/medicare', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, TextInput, View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const button = ({ label, onPress, disabled }: {
    label: string; onPress: () => void; disabled?: boolean;
  }) => React.createElement(
    Pressable,
    { accessibilityLabel: label, onPress, disabled },
    React.createElement(Text, null, label),
  );
  return {
    Screen: ({ children }: { children: import('react').ReactNode }) =>
      React.createElement(View, null, children),
    AppHeader: ({ title }: { title: string }) => React.createElement(Text, null, title),
    SafetyNotice: ({ title, message }: { title: string; message: string }) =>
      React.createElement(View, null,
        React.createElement(Text, null, title),
        React.createElement(Text, null, message)),
    SecondaryButton: button,
    TextField: ({ label, onChangeText, value }: {
      label: string; onChangeText: (value: string) => void; value: string;
    }) => React.createElement(TextInput, {
      accessibilityLabel: label, onChangeText, value,
    }),
  };
});

import { act, fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import { getFirebaseAuth } from '@/services/firebase';
import { useSessionStore } from '@/store';
import {
  watchCaregiverPlans,
  type CaregiverScheduleResult,
} from '@/features/family-care/data/family-link-repository';
import CaregiverDashboardScreen from './CaregiverDashboardScreen';

const session = {
  user: { id: 'caregiver-123', displayName: 'Người chăm sóc', role: 'caregiver' as const },
  signOut: jest.fn().mockResolvedValue(undefined),
  operationStatus: 'idle' as const,
  errorMessage: null,
};
const stop = jest.fn();
let deliver: ((value: CaregiverScheduleResult) => void) | null = null;

describe('Family Care: caregiver read-only linked schedule', () => {
  beforeEach(() => {
    session.user.id = 'caregiver-123';
    deliver = null;
    jest.clearAllMocks();
    (useSessionStore as unknown as jest.Mock).mockImplementation(
      (selector: (state: typeof session) => unknown) => selector(session),
    );
    jest.mocked(getFirebaseAuth).mockReturnValue({
      currentUser: { uid: 'caregiver-123' },
    } as unknown as ReturnType<typeof getFirebaseAuth>);
    jest.mocked(watchCaregiverPlans).mockImplementation((_caregiverUid, _ownerUid, onChange) => {
      deliver = onChange;
      onChange({ status: 'loading', plans: [] });
      return stop;
    });
  });

  it('does not fetch another account until the caregiver supplies its UID', async () => {
    const view = await render(<CaregiverDashboardScreen />);
    expect(view.getByText('Liên kết hồ sơ thật')).toBeTruthy();
    expect(view.getByText('caregiver-123')).toBeTruthy();
    expect(watchCaregiverPlans).not.toHaveBeenCalled();
    expect(view.queryByText('Lịch thuốc người thân · Chỉ xem')).toBeNull();

    await fireEvent.changeText(view.getByLabelText('Mã hồ sơ người cao tuổi'), 'elderly-123');
    await fireEvent.press(view.getByLabelText('Xem lịch người thân'));
    expect(watchCaregiverPlans).toHaveBeenCalledWith(
      'caregiver-123', 'elderly-123', expect.any(Function),
    );
    expect(view.getByText('Đang kiểm tra quyền và tải thuốc, lịch thuốc…')).toBeTruthy();
  });

  it('renders approved live planned times without editing or dose-report actions', async () => {
    const view = await render(<CaregiverDashboardScreen />);
    await fireEvent.changeText(view.getByLabelText('Mã hồ sơ người cao tuổi'), 'elderly-123');
    await fireEvent.press(view.getByLabelText('Xem lịch người thân'));
    await act(async () => {
      deliver?.({
        status: 'ready',
        plans: [
          { time: '08:00', medicationName: 'Metformin' },
          { time: '20:15', medicationName: 'Thuốc do người dùng nhập' },
        ],
        medicationNames: ['Metformin', 'Thuốc chưa có lịch hôm nay'],
      });
    });
    expect(view.getByText('08:00 · Metformin')).toBeTruthy();
    expect(view.getByText('20:15 · Thuốc do người dùng nhập')).toBeTruthy();
    expect(view.getByText('Danh sách thuốc đang dùng')).toBeTruthy();
    expect(view.getByText('• Thuốc chưa có lịch hôm nay')).toBeTruthy();
    expect(view.getByText('Lịch dự kiến, không phải xác nhận y tế')).toBeTruthy();
    expect(view.queryByLabelText('Đã uống')).toBeNull();
    expect(view.queryByLabelText('Chỉnh sửa thuốc')).toBeNull();
  });

  it('shows a data error without exposing stale medication rows', async () => {
    const view = await render(<CaregiverDashboardScreen />);
    await fireEvent.changeText(view.getByLabelText('Mã hồ sơ người cao tuổi'), 'elderly-123');
    await fireEvent.press(view.getByLabelText('Xem lịch người thân'));
    await act(async () => {
      deliver?.({ status: 'ready', plans: [{ time: '08:00', medicationName: 'Private medicine' }] });
    });
    expect(view.getByText('08:00 · Private medicine')).toBeTruthy();
    await act(async () => {
      deliver?.({ status: 'error', plans: [], message: 'Dữ liệu lịch thuốc không hợp lệ.' });
    });
    expect(view.getByText('Không thể tải lịch thuốc')).toBeTruthy();
    expect(view.queryByText('08:00 · Private medicine')).toBeNull();
  });

  it('hides all previously visible medicine details when a link is revoked', async () => {
    const view = await render(<CaregiverDashboardScreen />);
    await fireEvent.changeText(view.getByLabelText('Mã hồ sơ người cao tuổi'), 'elderly-123');
    await fireEvent.press(view.getByLabelText('Xem lịch người thân'));
    await act(async () => {
      deliver?.({
        status: 'ready',
        plans: [{ time: '08:00', medicationName: 'Metformin' }],
      });
    });
    expect(view.getByText('08:00 · Metformin')).toBeTruthy();
    await act(async () => {
      deliver?.({
        status: 'revoked', plans: [], message: 'Quyền đã được thu hồi.',
      });
    });
    expect(view.getByText('Không có quyền xem')).toBeTruthy();
    expect(view.queryByText('08:00 · Metformin')).toBeNull();
    expect(stop).not.toHaveBeenCalled();
  });

  it('unsubscribes on manual disconnect and removes all medicine details', async () => {
    const view = await render(<CaregiverDashboardScreen />);
    await fireEvent.changeText(view.getByLabelText('Mã hồ sơ người cao tuổi'), 'elderly-123');
    await fireEvent.press(view.getByLabelText('Xem lịch người thân'));
    await act(async () => {
      deliver?.({
        status: 'ready', plans: [{ time: '08:00', medicationName: 'Metformin' }],
      });
    });
    await fireEvent.press(view.getByLabelText('Đóng lịch người thân'));
    expect(stop).toHaveBeenCalledTimes(1);
    expect(view.queryByText('08:00 · Metformin')).toBeNull();
    expect(view.queryByText('Lịch thuốc người thân · Chỉ xem')).toBeNull();
  });


  it('ignores an old family member listener callback after switching to another profile', async () => {
    const view = await render(<CaregiverDashboardScreen />);
    await fireEvent.changeText(view.getByLabelText('Mã hồ sơ người cao tuổi'), 'elderly-123');
    await fireEvent.press(view.getByLabelText('Xem lịch người thân'));
    const staleCallback = deliver;
    await act(async () => {
      staleCallback?.({ status: 'ready', plans: [{ time: '08:00', medicationName: 'Medicine A' }] });
    });
    expect(view.getByText('08:00 · Medicine A')).toBeTruthy();

    await fireEvent.changeText(view.getByLabelText('Mã hồ sơ người cao tuổi'), 'elderly-456');
    await fireEvent.press(view.getByLabelText('Kết nối lại để tải dữ liệu mới'));
    expect(watchCaregiverPlans).toHaveBeenLastCalledWith('caregiver-123', 'elderly-456', expect.any(Function));
    expect(view.queryByText('08:00 · Medicine A')).toBeNull();

    await act(async () => {
      staleCallback?.({ status: 'ready', plans: [{ time: '12:00', medicationName: 'Private A' }] });
    });
    expect(view.queryByText('12:00 · Private A')).toBeNull();
    await act(async () => {
      deliver?.({ status: 'ready', plans: [{ time: '20:00', medicationName: 'Medicine B' }] });
    });
    expect(view.getByText('20:00 · Medicine B')).toBeTruthy();
    expect(view.queryByText('12:00 · Private A')).toBeNull();
  });

  it('drops a queued Firestore callback after manual disconnect', async () => {
    const view = await render(<CaregiverDashboardScreen />);
    await fireEvent.changeText(view.getByLabelText('Mã hồ sơ người cao tuổi'), 'elderly-123');
    await fireEvent.press(view.getByLabelText('Xem lịch người thân'));
    const staleCallback = deliver;
    await fireEvent.press(view.getByLabelText('Đóng lịch người thân'));
    await act(async () => {
      staleCallback?.({ status: 'ready', plans: [{ time: '08:00', medicationName: 'Sensitive Medicine' }] });
    });
    expect(view.queryByText('08:00 · Sensitive Medicine')).toBeNull();
    expect(view.queryByText('Lịch thuốc người thân · Chỉ xem')).toBeNull();
  });

  it('unsubscribes and discards previous caregiver data on account switch', async () => {
    const view = await render(<CaregiverDashboardScreen />);
    await fireEvent.changeText(view.getByLabelText('Mã hồ sơ người cao tuổi'), 'elderly-123');
    await fireEvent.press(view.getByLabelText('Xem lịch người thân'));
    await act(async () => {
      deliver?.({
        status: 'ready', plans: [{ time: '08:00', medicationName: 'Metformin' }],
      });
    });
    session.user.id = 'caregiver-456';
    await view.rerender(<CaregiverDashboardScreen />);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(view.queryByText('08:00 · Metformin')).toBeNull();
    expect(view.getByLabelText('Mã hồ sơ người cao tuổi').props.value).toBe('');
  });

  it('disconnects before signing out', async () => {
    const view = await render(<CaregiverDashboardScreen />);
    await fireEvent.changeText(view.getByLabelText('Mã hồ sơ người cao tuổi'), 'elderly-123');
    await fireEvent.press(view.getByLabelText('Xem lịch người thân'));
    await fireEvent.press(view.getByLabelText('Đăng xuất'));
    expect(stop).toHaveBeenCalledTimes(1);
    expect(session.signOut).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/login');
  });
});

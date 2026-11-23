/* eslint-disable import/first */

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/store', () => ({ useSessionStore: jest.fn() }));

jest.mock('@/components/medicare', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View, Text, Pressable, TextInput } = jest.requireActual<typeof import('react-native')>('react-native');
  const button = ({ title, label, onPress, disabled }: {
    title?: string; label?: string; onPress: () => void; disabled?: boolean;
  }) => React.createElement(
    Pressable,
    { accessibilityLabel: title ?? label, onPress, disabled },
    React.createElement(Text, null, title ?? label),
  );
  return {
    Screen: ({ children }: { children: import('react').ReactNode }) => React.createElement(View, null, children),
    AppHeader: ({ title }: { title: string }) => React.createElement(Text, null, title),
    DemoModeBanner: ({ description }: { description: string }) => React.createElement(Text, null, description),
    SafetyNotice: ({ title, message }: { title: string; message: string }) =>
      React.createElement(View, null, React.createElement(Text, null, title), React.createElement(Text, null, message)),
    ActionCard: button,
    SecondaryButton: button,
    TextField: ({ label, errorMessage, value, onChangeText }: {
      label: string; errorMessage?: string; value: string; onChangeText: (value: string) => void;
    }) => React.createElement(View, null,
      React.createElement(TextInput, { accessibilityLabel: label, value, onChangeText }),
      errorMessage ? React.createElement(Text, null, errorMessage) : null),
  };
});

import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Share } from 'react-native';

import { useSessionStore } from '@/store';
import { getReminderMessage, linkConversationMessage } from '../data/caregiver-demo';
import { buildSharedScheduleText } from '@/features/family-sharing/domain/shared-schedule';
import CaregiverDashboardScreen from './CaregiverDashboardScreen';

const session = {
  user: { id: 'caregiver-a', displayName: 'Người chăm sóc', role: 'caregiver' as const },
  signOut: jest.fn().mockResolvedValue(undefined),
  operationStatus: 'idle' as const,
  errorMessage: null,
};

const scheduleMessage = buildSharedScheduleText('2026-11-23', [
  { schedule: { localTime: '08:00' }, medication: { name: 'Thuốc nhập thực tế' } },
  { schedule: { localTime: '20:00' }, medication: { name: 'Thuốc buổi tối' } },
]) ?? '';

describe('CaregiverDashboardScreen manual data flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSessionStore as unknown as jest.Mock).mockImplementation(
      (selector: (state: typeof session) => unknown) => selector(session),
    );
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction, activityType: undefined });
  });
  afterEach(() => { jest.restoreAllMocks(); });

  it('does not display synthetic medicines; imports owner-forwarded schedule then clears it', async () => {
    const view = await render(<CaregiverDashboardScreen />);
    expect(view.getByText('Chưa có bản chia sẻ')).toBeTruthy();
    expect(view.queryByText('08:00 · Thuốc nhập thực tế')).toBeNull();
    expect(view.queryByText('Thuốc mẫu A')).toBeNull();
    await fireEvent.press(view.getByLabelText('Theo dõi lịch thuốc'));
    expect(view.getByText('Bản chia sẻ lịch thuốc')).toBeTruthy();
    await fireEvent.changeText(view.getByLabelText('Dán bản chia sẻ lịch thuốc'), scheduleMessage);
    await fireEvent.press(view.getByLabelText('Đọc bản lịch đã dán'));
    expect(view.getByText('08:00 · Thuốc nhập thực tế')).toBeTruthy();
    expect(view.getByText('20:00 · Thuốc buổi tối')).toBeTruthy();
    expect(view.getByText('Bản sao không tự cập nhật')).toBeTruthy();
    await fireEvent.press(view.getByLabelText('Xóa bản lịch đã nhập'));
    expect(view.queryByText('08:00 · Thuốc nhập thực tế')).toBeNull();
  });

  it('rejects an invalid copied message without displaying its contents', async () => {
    const view = await render(<CaregiverDashboardScreen />);
    await fireEvent.press(view.getByLabelText('Theo dõi lịch thuốc'));
    await fireEvent.changeText(view.getByLabelText('Dán bản chia sẻ lịch thuốc'), 'Thuốc mẫu bị giả mạo 500mg');
    await fireEvent.press(view.getByLabelText('Đọc bản lịch đã dán'));
    expect(view.getByText(/Bản chia sẻ chưa đúng định dạng hoặc bị cắt/)).toBeTruthy();
    expect(view.queryByText('Thuốc mẫu bị giả mạo 500mg')).toBeNull();
  });

  it('previews generic reminder messages and never sends automatically', async () => {
    const share = jest.spyOn(Share, 'share');
    const view = await render(<CaregiverDashboardScreen />);
    await fireEvent.press(view.getByLabelText('Nhắc người thân'));
    expect(share).not.toHaveBeenCalled();
    expect(view.getByText(getReminderMessage('schedule'))).toBeTruthy();
    await fireEvent.press(view.getByLabelText('Chọn lời hỏi thăm'));
    expect(view.getByText(getReminderMessage('checkIn'))).toBeTruthy();
    await fireEvent.press(view.getByLabelText('Mở bảng chia sẻ lời nhắc'));
    expect(share).toHaveBeenCalledWith({ message: getReminderMessage('checkIn') });
  });

  it('explains that the link message does not grant any permission', async () => {
    const share = jest.spyOn(Share, 'share');
    const view = await render(<CaregiverDashboardScreen />);
    await fireEvent.press(view.getByLabelText('Liên kết hồ sơ'));
    expect(view.getByText('Chưa cấp quyền')).toBeTruthy();
    expect(view.getByText(linkConversationMessage)).toBeTruthy();
    expect(share).not.toHaveBeenCalled();
    await fireEvent.press(view.getByLabelText('Mở bảng chia sẻ lời mời trao đổi'));
    expect(share).toHaveBeenCalledWith({ message: linkConversationMessage });
  });

  it('shows a failed share sheet without claiming delivery', async () => {
    jest.spyOn(Share, 'share').mockRejectedValueOnce(new Error('Unavailable'));
    const view = await render(<CaregiverDashboardScreen />);
    await fireEvent.press(view.getByLabelText('Nhắc người thân'));
    await fireEvent.press(view.getByLabelText('Mở bảng chia sẻ lời nhắc'));
    expect(view.getByText('Không mở được bảng chia sẻ')).toBeTruthy();
  });

  it('clears the imported data when signing out', async () => {
    const view = await render(<CaregiverDashboardScreen />);
    await fireEvent.press(view.getByLabelText('Theo dõi lịch thuốc'));
    await fireEvent.changeText(view.getByLabelText('Dán bản chia sẻ lịch thuốc'), scheduleMessage);
    await fireEvent.press(view.getByLabelText('Đọc bản lịch đã dán'));
    expect(view.getByText('08:00 · Thuốc nhập thực tế')).toBeTruthy();
    await fireEvent.press(view.getByLabelText('Đăng xuất'));
    expect(session.signOut).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/login');
    expect(view.queryByText('08:00 · Thuốc nhập thực tế')).toBeNull();
  });
});

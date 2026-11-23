/* eslint-disable import/first */

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/store', () => ({ useSessionStore: jest.fn() }));

jest.mock('@/components/medicare', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View, Text, Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
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
    StatusBadge: ({ label }: { label: string }) => React.createElement(Text, null, label),
    ActionCard: button,
    SecondaryButton: button,
  };
});

import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Share } from 'react-native';

import { useSessionStore } from '@/store';
import { getReminderMessage, linkConversationMessage } from '../data/caregiver-demo';
import CaregiverDashboardScreen from './CaregiverDashboardScreen';

const session = {
  user: { id: 'caregiver-demo', displayName: 'Người chăm sóc mẫu', role: 'caregiver' as const },
  signOut: jest.fn().mockResolvedValue(undefined),
  operationStatus: 'idle' as const,
  errorMessage: null,
};

describe('CaregiverDashboardScreen basic demo flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSessionStore as unknown as jest.Mock).mockImplementation(
      (selector: (state: typeof session) => unknown) => selector(session),
    );
    jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction, activityType: undefined });
  });

  afterEach(() => { jest.restoreAllMocks(); });

  it('only renders synthetic schedule when requested; can filter and collapse', async () => {
    const view = await render(<CaregiverDashboardScreen />);
    expect(view.getByText('Hồ sơ minh họa')).toBeTruthy();
    expect(view.queryByText('08:00 · Thuốc mẫu A')).toBeNull();
    await fireEvent.press(view.getByLabelText('Theo dõi lịch thuốc'));
    expect(view.getByText('08:00 · Thuốc mẫu A')).toBeTruthy();
    expect(view.getByText('20:00 · Thuốc mẫu C')).toBeTruthy();
    expect(view.getByText('Không tự suy đoán bỏ liều')).toBeTruthy();
    await fireEvent.press(view.getByLabelText('Chỉ xem chưa phản hồi'));
    expect(view.queryByText('08:00 · Thuốc mẫu A')).toBeNull();
    expect(view.getByText('20:00 · Thuốc mẫu C')).toBeTruthy();
    await fireEvent.press(view.getByLabelText('Xem tất cả lịch minh họa'));
    expect(view.getByText('13:00 · Thuốc mẫu B')).toBeTruthy();
    await fireEvent.press(view.getByLabelText('Ẩn lịch thuốc minh họa'));
    expect(view.queryByText('20:00 · Thuốc mẫu C')).toBeNull();
  });

  it('previews generic reminder messages; sharing requires explicit press', async () => {
    const share = jest.spyOn(Share, 'share');
    const view = await render(<CaregiverDashboardScreen />);
    await fireEvent.press(view.getByLabelText('Nhắc người thân'));
    expect(share).not.toHaveBeenCalled();
    expect(view.getByText(getReminderMessage('schedule'))).toBeTruthy();
    await fireEvent.press(view.getByLabelText('Chọn lời hỏi thăm'));
    expect(view.getByText(getReminderMessage('checkIn'))).toBeTruthy();
    await fireEvent.press(view.getByLabelText('Mở bảng chia sẻ lời nhắc'));
    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({ message: getReminderMessage('checkIn') });
    expect(view.getByText(/Không có thông báo đẩy hay SMS tự động/)).toBeTruthy();
  });

  it('does not grant caregiver rights; invitation is a separate share-sheet handoff', async () => {
    const share = jest.spyOn(Share, 'share');
    const view = await render(<CaregiverDashboardScreen />);
    await fireEvent.press(view.getByLabelText('Liên kết hồ sơ'));
    expect(view.getByText('Chưa cấp quyền')).toBeTruthy();
    expect(view.getByText(linkConversationMessage)).toBeTruthy();
    expect(share).not.toHaveBeenCalled();
    await fireEvent.press(view.getByLabelText('Mở bảng chia sẻ lời mời trao đổi'));
    expect(share).toHaveBeenCalledWith({ message: linkConversationMessage });
    expect(view.getByText('Liên kết hồ sơ · Chưa kích hoạt')).toBeTruthy();
  });

  it('shows an error without claiming an outgoing message was delivered', async () => {
    jest.spyOn(Share, 'share').mockRejectedValueOnce(new Error('Cannot open'));
    const view = await render(<CaregiverDashboardScreen />);
    await fireEvent.press(view.getByLabelText('Nhắc người thân'));
    await fireEvent.press(view.getByLabelText('Mở bảng chia sẻ lời nhắc'));
    expect(view.getByText('Không mở được bảng chia sẻ')).toBeTruthy();
    expect(view.getByText(/Không có tin nhắn nào được gửi từ ứng dụng/)).toBeTruthy();
  });

  it('keeps existing sign-out navigation', async () => {
    const view = await render(<CaregiverDashboardScreen />);
    await fireEvent.press(view.getByLabelText('Đăng xuất'));
    expect(session.signOut).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith('/login');
  });
});

/* eslint-disable import/first */
jest.mock('@/components/medicare', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, View, Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SecondaryButton: ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) =>
      React.createElement(Pressable, { accessibilityLabel: label, onPress, disabled }, React.createElement(Text, null, label)),
    SafetyNotice: ({ title }: { title: string }) =>
      React.createElement(View, null, React.createElement(Text, null, title)),
  };
});

import { fireEvent, render } from '@testing-library/react-native';
import { Share } from 'react-native';

import { ShareTodayScheduleButton } from './ShareTodayScheduleButton';

describe('explicit owner schedule sharing', () => {
  beforeEach(() => {
    jest.spyOn(Share, 'share').mockResolvedValue({
      action: Share.dismissedAction,
      activityType: undefined,
    });
  });

  afterEach(() => { jest.restoreAllMocks(); });

  it('does not send any data until an independent consent action is pressed', async () => {
    const share = jest.spyOn(Share, 'share');
    const text = 'private schedule snapshot';
    const view = await render(<ShareTodayScheduleButton message={text} />);
    expect(share).not.toHaveBeenCalled();
    expect(view.queryByText('Chỉ chia sẻ khi bạn đồng ý')).toBeNull();
    await fireEvent.press(view.getByLabelText('Chia sẻ lịch thuốc hôm nay'));
    expect(share).not.toHaveBeenCalled();
    expect(view.getByText('Chỉ chia sẻ khi bạn đồng ý')).toBeTruthy();
    await fireEvent.press(view.getByLabelText('Tôi đồng ý — mở bảng chia sẻ'));
    expect(share).toHaveBeenCalledWith({ message: text });
  });

  it('closes its review without showing a share sheet', async () => {
    const share = jest.spyOn(Share, 'share');
    const view = await render(<ShareTodayScheduleButton message="private" />);
    await fireEvent.press(view.getByLabelText('Chia sẻ lịch thuốc hôm nay'));
    await fireEvent.press(view.getByLabelText('Ẩn phần chia sẻ lịch thuốc'));
    expect(share).not.toHaveBeenCalled();
    expect(view.queryByText('Chỉ chia sẻ khi bạn đồng ý')).toBeNull();
  });

  it('requires fresh consent after the actual schedule changes', async () => {
    const share = jest.spyOn(Share, 'share');
    const view = await render(<ShareTodayScheduleButton message="version-a" />);
    await fireEvent.press(view.getByLabelText('Chia sẻ lịch thuốc hôm nay'));
    expect(view.getByLabelText('Tôi đồng ý — mở bảng chia sẻ')).toBeTruthy();
    await view.rerender(<ShareTodayScheduleButton message="version-b" />);
    expect(view.queryByLabelText('Tôi đồng ý — mở bảng chia sẻ')).toBeNull();
    expect(share).not.toHaveBeenCalled();
  });

  it('handles share errors without claiming a message was delivered', async () => {
    jest.spyOn(Share, 'share').mockRejectedValueOnce(new Error('Unavailable'));
    const view = await render(<ShareTodayScheduleButton message="private" />);
    await fireEvent.press(view.getByLabelText('Chia sẻ lịch thuốc hôm nay'));
    await fireEvent.press(view.getByLabelText('Tôi đồng ý — mở bảng chia sẻ'));
    expect(view.getByText('Không mở được bảng chia sẻ')).toBeTruthy();
  });
});

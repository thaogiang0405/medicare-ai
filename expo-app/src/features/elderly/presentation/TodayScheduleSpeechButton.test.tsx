/* eslint-disable import/first */

jest.mock('expo-router', () => ({
  useFocusEffect: jest.requireActual<typeof import('react')>('react').useEffect,
}));

jest.mock('expo-speech', () => ({
  getAvailableVoicesAsync: jest.fn(),
  speak: jest.fn(),
  stop: jest.fn(),
}));

jest.mock('@/components/medicare', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SecondaryButton: ({ label, onPress }: { label: string; onPress: () => void }) =>
      React.createElement(Pressable, { accessibilityLabel: label, onPress }, React.createElement(Text, null, label)),
  };
});

import { act, fireEvent, render } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import { Alert } from 'react-native';

import { TodayScheduleSpeechButton } from './TodayScheduleSpeechButton';

const play = 'Nghe lịch thuốc hôm nay';
const preparing = 'Hủy chuẩn bị giọng đọc';
const stop = 'Dừng đọc lịch thuốc';
const message = 'Lịch thuốc dự kiến hôm nay. 8 giờ, Thuốc mẫu.';
const voices = jest.mocked(Speech.getAvailableVoicesAsync);
const speak = jest.mocked(Speech.speak);
const stopSpeech = jest.mocked(Speech.stop);

describe('TodayScheduleSpeechButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    voices.mockResolvedValue([
      { identifier: 'voice-en', name: 'English', language: 'en-US', quality: 'Default' as Speech.Voice['quality'] },
      { identifier: 'voice-vi', name: 'Tiếng Việt', language: 'vi-VN', quality: 'Default' as Speech.Voice['quality'] },
    ]);
    stopSpeech.mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('only shows playback after native onStart; pressing stop ignores stale callbacks', async () => {
    const view = await render(<TodayScheduleSpeechButton message={message} />);
    expect(speak).not.toHaveBeenCalled();
    await fireEvent.press(view.getByLabelText(play));
    expect(view.getByLabelText(preparing)).toBeTruthy();
    expect(view.queryByLabelText(stop)).toBeNull();
    expect(speak).toHaveBeenCalledWith(message, expect.objectContaining({ language: 'vi-VN', voice: 'voice-vi' }));

    const options = speak.mock.calls[0]?.[1];
    await act(async () => { options?.onStart?.(); });
    await fireEvent.press(view.getByLabelText(stop));
    expect(stopSpeech).toHaveBeenCalledTimes(1);
    await act(async () => { options?.onStart?.(); });
    expect(view.getByLabelText(play)).toBeTruthy();
  });

  it('stops and resets if the engine never signals playback', async () => {
    jest.useFakeTimers();
    const view = await render(<TodayScheduleSpeechButton message={message} />);
    await fireEvent.press(view.getByLabelText(play));
    expect(view.getByLabelText(preparing)).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(8000); });
    expect(stopSpeech).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith('Giọng đọc chưa bắt đầu', expect.any(String));
    expect(view.getByLabelText(play)).toBeTruthy();
  });

  it('does not select another language when Vietnamese is unavailable', async () => {
    voices.mockResolvedValue([]);
    const view = await render(<TodayScheduleSpeechButton message={message} />);
    await fireEvent.press(view.getByLabelText(play));
    expect(Alert.alert).toHaveBeenCalledWith('Không thể đọc lịch thuốc', expect.stringContaining('giọng tiếng Việt'));
    expect(speak).not.toHaveBeenCalled();
    expect(view.getByLabelText(play)).toBeTruthy();
  });

  it('stops an active playback when its screen is removed', async () => {
    const view = await render(<TodayScheduleSpeechButton message={message} />);
    await fireEvent.press(view.getByLabelText(play));
    await act(async () => { speak.mock.calls[0]?.[1]?.onStart?.(); });
    await view.unmount();
    expect(stopSpeech).toHaveBeenCalledTimes(1);
  });
});

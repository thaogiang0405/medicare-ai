import { useFocusEffect } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useRef, useState } from 'react';
import { Alert, AppState, Platform } from 'react-native';

import { SecondaryButton } from '@/components/medicare';

export function TodayScheduleSpeechButton({ message }: Readonly<{ message: string }>) {
  const [phase, setPhase] = useState<'idle' | 'preparing' | 'playing'>('idle');
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearStartTimer = useCallback(() => {
    if (startTimer.current !== null) {
      clearTimeout(startTimer.current);
      startTimer.current = null;
    }
  }, []);
  const active = useRef<number | null>(null);
  const sequence = useRef(0);

  const stop = useCallback(() => {
    if (active.current === null) return;
    active.current = null;
    clearStartTimer();
    void Speech.stop().catch(() => undefined);
  }, [clearStartTimer]);

  useFocusEffect(useCallback(() => {
    setPhase('idle');
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        stop();
        setPhase('idle');
      }
    });
    return () => {
      subscription.remove();
      stop();
    };
  }, [stop]));

  const toggleSpeech = async () => {
    if (active.current !== null) {
      stop();
      setPhase('idle');
      return;
    }
    const id = ++sequence.current;
    active.current = id;
    setPhase('preparing');

    const finish = () => {
      if (active.current !== id) return;
      active.current = null;
      clearStartTimer();
      setPhase('idle');
    };

    const reportError = (description: string) => {
      if (active.current !== id) return;
      finish();
      Alert.alert('Không thể đọc lịch thuốc', description);
    };

    const audioError = () => reportError('Hãy kiểm tra âm lượng và chế độ im lặng rồi thử lại.');
    startTimer.current = setTimeout(() => {
      if (active.current !== id) return;
      stop();
      setPhase('idle');
      Alert.alert('Giọng đọc chưa bắt đầu', 'Hãy thử lại và kiểm tra giọng tiếng Việt trong Cài đặt của thiết bị.');
    }, 8000);
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      if (active.current !== id) return;
      const voice = voices.find((item) => /^vi(?:[-_]|$)/i.test(item.language));
      if (!voice) {
        reportError('Thiết bị chưa có giọng tiếng Việt. Bạn vẫn có thể xem lịch trên màn hình.');
        return;
      }
      Speech.speak(message, {
        language: 'vi-VN',
        voice: voice.identifier,
        rate: 0.85,
        ...(Platform.OS === 'ios' ? { useApplicationAudioSession: false } : {}),
        onStart: () => {
          if (active.current !== id) return;
          clearStartTimer();
          setPhase('playing');
        },
        onDone: finish,
        onStopped: finish,
        onError: audioError,
      });
    } catch {
      audioError();
    }
  };

  return (
    <SecondaryButton
      accessibilityHint="Chỉ phát khi bạn bấm nút; không thay đổi lịch hoặc ghi nhận đã uống"
      label={phase === 'preparing' ? 'Hủy chuẩn bị giọng đọc' : phase === 'playing' ? 'Dừng đọc lịch thuốc' : 'Nghe lịch thuốc hôm nay'}
      onPress={() => void toggleSpeech()}
    />
  );
}

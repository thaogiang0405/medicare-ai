import { useFocusEffect } from 'expo-router';
import * as Speech from 'expo-speech';
import { useCallback, useRef, useState } from 'react';
import { Alert, AppState } from 'react-native';

import { SecondaryButton } from '@/components/medicare';

export function TodayScheduleSpeechButton({ message }: Readonly<{ message: string }>) {
  const [playing, setPlaying] = useState(false);
  const active = useRef<number | null>(null);
  const sequence = useRef(0);

  const stop = useCallback(() => {
    if (active.current === null) return;
    active.current = null;
    void Speech.stop().catch(() => undefined);
  }, []);

  useFocusEffect(useCallback(() => {
    setPlaying(false);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        stop();
        setPlaying(false);
      }
    });
    return () => {
      subscription.remove();
      stop();
    };
  }, [message, stop]));

  const toggleSpeech = async () => {
    if (active.current !== null) {
      stop();
      setPlaying(false);
      return;
    }
    const id = ++sequence.current;
    active.current = id;
    setPlaying(true);

    const finish = () => {
      if (active.current !== id) return;
      active.current = null;
      setPlaying(false);
    };

    const reportError = (description: string) => {
      if (active.current !== id) return;
      finish();
      Alert.alert('Không thể đọc lịch thuốc', description);
    };

    const audioError = () => reportError('Hãy kiểm tra âm lượng và chế độ im lặng rồi thử lại.');
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
      label={playing ? 'Dừng đọc lịch thuốc' : 'Nghe lịch thuốc hôm nay'}
      onPress={() => void toggleSpeech()}
    />
  );
}

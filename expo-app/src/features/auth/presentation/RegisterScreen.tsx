import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  AppHeader,
  DemoModeBanner,
  PrimaryButton,
  Screen,
  TextField,
} from '@/components/medicare';
import { medicareColors, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';
import { useSessionStore } from '@/store';

export default function RegisterScreen() {
  const register = useSessionStore((state) => state.register);
  const isLoading = useSessionStore((state) => state.isLoading);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const createDemoAccount = async () => {
    setErrorMessage(undefined);

    try {
      await register({ displayName, email, password });
      router.replace('/role-selection');
    } catch {
      setErrorMessage('Không thể tạo tài khoản trình diễn. Vui lòng thử lại.');
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader onBack={() => router.back()} title="Tạo tài khoản" />
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          Thông tin cơ bản
        </Text>
        <Text style={styles.description}>Nhập thông tin để thử luồng ứng dụng, sau đó chọn vai trò.</Text>
      </View>
      <DemoModeBanner
        description="Dữ liệu này chỉ tồn tại trong phiên dùng thử và không tạo tài khoản Firebase."
        title="Chế độ trình diễn"
      />
      <View style={styles.form}>
        <TextField
          autoComplete="name"
          label="Họ và tên"
          onChangeText={setDisplayName}
          placeholder="Ví dụ: Cô Minh"
          value={displayName}
        />
        <TextField
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          placeholder="vidu@email.com"
          value={email}
        />
        <TextField
          errorMessage={errorMessage}
          label="Mật khẩu"
          onChangeText={setPassword}
          placeholder="Ít nhất 6 ký tự"
          secureTextEntry
          value={password}
        />
      </View>
      <PrimaryButton
        accessibilityHint="Tạo dữ liệu demo rồi chuyển đến màn hình chọn vai trò"
        label="Tiếp tục chọn vai trò"
        loading={isLoading}
        onPress={() => void createDemoAccount()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: medicareSpacing.xl,
  },
  heading: {
    gap: medicareSpacing.xs,
  },
  title: {
    color: medicareColors.text,
    fontSize: medicareTypography.display,
    fontWeight: '800',
    lineHeight: 40,
  },
  description: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.body,
    lineHeight: medicareTypography.lineHeightBody,
  },
  form: {
    gap: medicareSpacing.lg,
  },
});

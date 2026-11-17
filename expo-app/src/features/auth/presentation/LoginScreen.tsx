import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  AppHeader,
  DemoModeBanner,
  PrimaryButton,
  Screen,
  SecondaryButton,
  TextField,
} from '@/components/medicare';
import { medicareColors, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';
import { useSessionStore } from '@/store';

export default function LoginScreen() {
  const signIn = useSessionStore((state) => state.signIn);
  const isLoading = useSessionStore((state) => state.isLoading);
  const [identifier, setIdentifier] = useState('demo@medicare.ai');
  const [password, setPassword] = useState('123456');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const continueToRoleSelection = async () => {
    setErrorMessage(undefined);

    try {
      await signIn({ identifier, password });
      router.replace('/role-selection');
    } catch {
      setErrorMessage('Không thể tiếp tục ở chế độ trình diễn. Vui lòng thử lại.');
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader onBack={() => router.back()} title="Đăng nhập" />
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          Chào mừng trở lại
        </Text>
        <Text style={styles.description}>Bạn có thể tiếp tục bằng dữ liệu demo trong Migration 1.</Text>
      </View>
      <DemoModeBanner
        description="Thông tin nhập ở đây không được gửi lên Firebase và sẽ không được lưu lại."
        title="Chế độ trình diễn"
      />
      <View style={styles.form}>
        <TextField
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          label="Email hoặc số điện thoại"
          onChangeText={setIdentifier}
          placeholder="Nhập email hoặc số điện thoại"
          value={identifier}
        />
        <TextField
          errorMessage={errorMessage}
          label="Mật khẩu"
          onChangeText={setPassword}
          placeholder="Nhập mật khẩu"
          secureTextEntry
          value={password}
        />
      </View>
      <View style={styles.actions}>
        <PrimaryButton
          accessibilityHint="Tiếp tục đến bước chọn vai trò bằng dữ liệu demo"
          label="Tiếp tục"
          loading={isLoading}
          onPress={() => void continueToRoleSelection()}
        />
        <SecondaryButton label="Tạo tài khoản trình diễn" onPress={() => router.push('/register')} />
      </View>
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
  actions: {
    gap: medicareSpacing.sm,
  },
});

import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  AppHeader,
  PrimaryButton,
  Screen,
  SecondaryButton,
  TextField,
} from '@/components/medicare';
import { medicareColors, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';
import { useSessionStore } from '@/store';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function LoginScreen() {
  const signIn = useSessionStore((state) => state.signIn);
  const sendPasswordReset = useSessionStore((state) => state.sendPasswordReset);
  const operationStatus = useSessionStore((state) => state.operationStatus);
  const sessionErrorMessage = useSessionStore((state) => state.errorMessage);
  const clearError = useSessionStore((state) => state.clearError);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formErrorMessage, setFormErrorMessage] = useState<string | undefined>();
  const [resetNotice, setResetNotice] = useState<string | undefined>();
  const isLoading = operationStatus === 'loading';

  const resetFeedback = () => {
    setFormErrorMessage(undefined);
    setResetNotice(undefined);
    clearError();
  };

  const signInWithEmail = async () => {
    resetFeedback();

    if (!isValidEmail(email.trim())) {
      setFormErrorMessage('Hãy nhập địa chỉ email hợp lệ.');
      return;
    }

    if (!password) {
      setFormErrorMessage('Hãy nhập mật khẩu.');
      return;
    }

    try {
      await signIn({ email: email.trim(), password });
      // Auth + profile state decides whether onboarding or a persisted role
      // dashboard is the valid next route.
    } catch {
      // The repository has already mapped the error to safe Vietnamese feedback.
    }
  };

  const requestPasswordReset = async () => {
    resetFeedback();

    if (!isValidEmail(email.trim())) {
      setFormErrorMessage('Nhập email hợp lệ trước khi yêu cầu đặt lại mật khẩu.');
      return;
    }

    try {
      await sendPasswordReset(email.trim());
      setResetNotice('Nếu email phù hợp, hướng dẫn đặt lại mật khẩu sẽ được gửi đến hộp thư của bạn.');
    } catch {
      // Keep reset feedback neutral so it never confirms whether an account exists.
    }
  };

  const errorMessage = formErrorMessage ?? sessionErrorMessage ?? undefined;

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader onBack={() => router.back()} title="Đăng nhập" />
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          Chào mừng trở lại
        </Text>
        <Text style={styles.description}>Đăng nhập bằng email đã đăng ký với MediCare AI.</Text>
      </View>
      <View style={styles.form}>
        <TextField
          autoCapitalize="none"
          autoComplete="email"
          editable={!isLoading}
          keyboardType="email-address"
          label="Email"
          onChangeText={(value) => {
            setEmail(value);
            resetFeedback();
          }}
          placeholder="vidu@email.com"
          textContentType="emailAddress"
          value={email}
        />
        <TextField
          autoComplete="current-password"
          editable={!isLoading}
          errorMessage={errorMessage}
          label="Mật khẩu"
          onChangeText={(value) => {
            setPassword(value);
            resetFeedback();
          }}
          placeholder="Nhập mật khẩu"
          secureTextEntry
          showPasswordToggle
          textContentType="password"
          value={password}
        />
      </View>
      {resetNotice ? (
        <Text accessibilityLiveRegion="polite" style={styles.notice}>
          {resetNotice}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <PrimaryButton
          accessibilityHint="Đăng nhập bằng email và mật khẩu đã nhập"
          label="Đăng nhập"
          loading={isLoading}
          onPress={() => void signInWithEmail()}
        />
        <SecondaryButton
          accessibilityHint="Gửi hướng dẫn đặt lại mật khẩu nếu email phù hợp"
          disabled={isLoading}
          label="Quên mật khẩu?"
          onPress={() => void requestPasswordReset()}
        />
        <SecondaryButton
          accessibilityHint="Mở màn hình tạo tài khoản mới"
          disabled={isLoading}
          label="Tạo tài khoản"
          onPress={() => router.push('/register')}
        />
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
  notice: {
    color: medicareColors.success,
    fontSize: medicareTypography.bodySmall,
    fontWeight: '600',
    lineHeight: 22,
  },
});

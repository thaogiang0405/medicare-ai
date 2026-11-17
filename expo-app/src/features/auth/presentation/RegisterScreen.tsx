import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { AppHeader, PrimaryButton, Screen, TextField } from '@/components/medicare';
import { medicareColors, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';
import { useSessionStore } from '@/store';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function RegisterScreen() {
  const register = useSessionStore((state) => state.register);
  const operationStatus = useSessionStore((state) => state.operationStatus);
  const sessionErrorMessage = useSessionStore((state) => state.errorMessage);
  const clearError = useSessionStore((state) => state.clearError);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formErrorMessage, setFormErrorMessage] = useState<string | undefined>();
  const isLoading = operationStatus === 'loading';

  const resetFeedback = () => {
    setFormErrorMessage(undefined);
    clearError();
  };

  const createAccount = async () => {
    resetFeedback();

    if (displayName.trim().length < 2) {
      setFormErrorMessage('Hãy nhập họ và tên để chúng tôi xưng hô phù hợp.');
      return;
    }

    if (!isValidEmail(email.trim())) {
      setFormErrorMessage('Hãy nhập địa chỉ email hợp lệ.');
      return;
    }

    if (password.length < 6) {
      setFormErrorMessage('Mật khẩu cần có ít nhất 6 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      setFormErrorMessage('Xác nhận mật khẩu chưa khớp.');
      return;
    }

    try {
      await register({ displayName: displayName.trim(), email: email.trim(), password });
      router.replace('/role-selection');
    } catch {
      // The repository has already mapped the error to safe Vietnamese feedback.
    }
  };

  const errorMessage = formErrorMessage ?? sessionErrorMessage ?? undefined;

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader onBack={() => router.back()} title="Tạo tài khoản" />
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>
          Thông tin cơ bản
        </Text>
        <Text style={styles.description}>
          Tài khoản được tạo bằng Firebase Authentication. Vai trò và hồ sơ sức khỏe chưa được lưu ở giai đoạn này.
        </Text>
      </View>
      <View style={styles.form}>
        <TextField
          autoComplete="name"
          editable={!isLoading}
          label="Họ và tên"
          onChangeText={(value) => {
            setDisplayName(value);
            resetFeedback();
          }}
          placeholder="Ví dụ: Cô Minh"
          textContentType="name"
          value={displayName}
        />
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
          autoComplete="new-password"
          editable={!isLoading}
          helperText="Ít nhất 6 ký tự; Firebase sẽ kiểm tra chính sách mật khẩu hiện hành."
          label="Mật khẩu"
          onChangeText={(value) => {
            setPassword(value);
            resetFeedback();
          }}
          placeholder="Tạo mật khẩu"
          secureTextEntry
          showPasswordToggle
          textContentType="newPassword"
          value={password}
        />
        <TextField
          autoComplete="new-password"
          editable={!isLoading}
          errorMessage={errorMessage}
          label="Xác nhận mật khẩu"
          onChangeText={(value) => {
            setConfirmPassword(value);
            resetFeedback();
          }}
          placeholder="Nhập lại mật khẩu"
          secureTextEntry
          showPasswordToggle
          textContentType="newPassword"
          value={confirmPassword}
        />
      </View>
      <PrimaryButton
        accessibilityHint="Tạo tài khoản Firebase bằng thông tin đã nhập"
        label="Tạo tài khoản"
        loading={isLoading}
        onPress={() => void createAccount()}
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

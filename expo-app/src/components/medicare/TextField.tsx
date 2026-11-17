import { useState } from 'react';
import type { TextInputProps } from 'react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  medicareColors,
  medicareRadius,
  medicareSpacing,
  medicareTypography,
} from '@/constants/medicare-theme';

export type TextFieldProps = TextInputProps & {
  label: string;
  errorMessage?: string;
  helperText?: string;
  showPasswordToggle?: boolean;
};

export function TextField({
  label,
  errorMessage,
  helperText,
  showPasswordToggle = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  secureTextEntry,
  ...inputProps
}: TextFieldProps) {
  const message = errorMessage ?? helperText;
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const canTogglePassword = showPasswordToggle && secureTextEntry;
  const resolvedSecureTextEntry = canTogglePassword ? !isPasswordVisible : secureTextEntry;

  return (
    <View style={styles.wrapper}>
      <Text maxFontSizeMultiplier={1.5} style={styles.label}>
        {label}
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          accessibilityHint={accessibilityHint ?? helperText}
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ disabled: inputProps.editable === false }}
          placeholderTextColor={medicareColors.textMuted}
          secureTextEntry={resolvedSecureTextEntry}
          style={[
            styles.input,
            canTogglePassword && styles.inputWithPasswordToggle,
            Boolean(errorMessage) && styles.inputError,
            style,
          ]}
          {...inputProps}
        />
        {canTogglePassword ? (
          <Pressable
            accessibilityHint="Thay đổi việc hiển thị mật khẩu"
            accessibilityLabel={isPasswordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            accessibilityRole="button"
            onPress={() => setIsPasswordVisible((visible) => !visible)}
            style={({ pressed }) => [styles.passwordToggle, pressed && styles.passwordTogglePressed]}>
            <Text maxFontSizeMultiplier={1.35} style={styles.passwordToggleLabel}>
              {isPasswordVisible ? 'Ẩn' : 'Hiện'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {message ? (
        <Text
          accessibilityLiveRegion={errorMessage ? 'assertive' : 'polite'}
          maxFontSizeMultiplier={1.5}
          style={[styles.message, errorMessage ? styles.errorMessage : styles.helperMessage]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: medicareSpacing.xs,
  },
  label: {
    color: medicareColors.text,
    fontSize: medicareTypography.label,
    fontWeight: '700',
    lineHeight: 23,
  },
  input: {
    flex: 1,
    minHeight: 56,
    borderWidth: 1.5,
    borderColor: medicareColors.border,
    borderRadius: medicareRadius.md,
    color: medicareColors.text,
    backgroundColor: medicareColors.surfaceElevated,
    fontSize: medicareTypography.body,
    lineHeight: medicareTypography.lineHeightBody,
    paddingHorizontal: medicareSpacing.md,
    paddingVertical: medicareSpacing.sm,
  },
  inputRow: {
    position: 'relative',
  },
  inputWithPasswordToggle: {
    paddingRight: 78,
  },
  passwordToggle: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 66,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: medicareRadius.sm,
  },
  passwordTogglePressed: {
    backgroundColor: medicareColors.primaryContainer,
  },
  passwordToggleLabel: {
    color: medicareColors.primary,
    fontSize: medicareTypography.bodySmall,
    fontWeight: '800',
  },
  inputError: {
    borderColor: medicareColors.error,
  },
  message: {
    fontSize: medicareTypography.bodySmall,
    lineHeight: 22,
  },
  helperMessage: {
    color: medicareColors.textMuted,
  },
  errorMessage: {
    color: medicareColors.error,
    fontWeight: '600',
  },
});

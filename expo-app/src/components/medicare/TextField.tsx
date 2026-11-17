import type { TextInputProps } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';

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
};

export function TextField({
  label,
  errorMessage,
  helperText,
  accessibilityLabel,
  accessibilityHint,
  style,
  ...inputProps
}: TextFieldProps) {
  const message = errorMessage ?? helperText;

  return (
    <View style={styles.wrapper}>
      <Text maxFontSizeMultiplier={1.5} style={styles.label}>
        {label}
      </Text>
      <TextInput
        accessibilityHint={accessibilityHint ?? helperText}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: inputProps.editable === false }}
        placeholderTextColor={medicareColors.textMuted}
        style={[styles.input, Boolean(errorMessage) && styles.inputError, style]}
        {...inputProps}
      />
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

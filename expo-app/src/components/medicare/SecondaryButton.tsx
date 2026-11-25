import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

import {
  medicareColors,
  medicareRadius,
  medicareSpacing,
  medicareTypography,
} from '@/constants/medicare-theme';

export type SecondaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function SecondaryButton({
  label,
  onPress,
  disabled = false,
  accessibilityHint,
  style,
  testID,
}: SecondaryButtonProps) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
      testID={testID}>
      <Text maxFontSizeMultiplier={1.25} style={[styles.label, disabled && styles.disabledLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 60,
    borderWidth: 1.5,
    borderColor: medicareColors.border,
    borderRadius: medicareRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: medicareSpacing.lg,
    paddingVertical: medicareSpacing.sm,
    backgroundColor: medicareColors.surfaceElevated,
  },
  label: {
    color: medicareColors.primary,
    fontSize: medicareTypography.label,
    fontWeight: '700',
    lineHeight: 23,
    textAlign: 'center',
  },
  pressed: {
    backgroundColor: medicareColors.primaryContainer,
  },
  disabled: {
    borderColor: medicareColors.disabled,
  },
  disabledLabel: {
    color: medicareColors.disabledText,
  },
});

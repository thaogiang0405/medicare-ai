import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  medicareAccessibility,
  medicareColors,
  medicareRadius,
  medicareSpacing,
  medicareTypography,
} from '@/constants/medicare-theme';

export type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  icon,
  accessibilityHint,
  style,
  testID,
}: PrimaryButtonProps) {
  const unavailable = disabled || loading;

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        unavailable && styles.disabled,
        pressed && !unavailable && styles.pressed,
        style,
      ]}
      testID={testID}>
      {loading ? <ActivityIndicator color={medicareColors.onPrimary} /> : null}
      {!loading && icon ? <View style={styles.icon}>{icon}</View> : null}
      <Text maxFontSizeMultiplier={1.35} style={[styles.label, unavailable && styles.disabledLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: medicareAccessibility.minTouchTarget,
    borderRadius: medicareRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: medicareSpacing.xs,
    paddingHorizontal: medicareSpacing.lg,
    paddingVertical: medicareSpacing.sm,
    backgroundColor: medicareColors.primary,
  },
  label: {
    color: medicareColors.onPrimary,
    fontSize: medicareTypography.label,
    fontWeight: '700',
    lineHeight: 23,
    textAlign: 'center',
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: medicareColors.primaryPressed,
  },
  disabled: {
    backgroundColor: medicareColors.disabled,
  },
  disabledLabel: {
    color: medicareColors.disabledText,
  },
});

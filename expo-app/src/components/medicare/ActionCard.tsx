import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  medicareColors,
  medicareRadius,
  medicareShadow,
  medicareSpacing,
  medicareTypography,
} from '@/constants/medicare-theme';

export type ActionCardProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ActionCard({
  title,
  description,
  icon,
  onPress,
  disabled = false,
  accessibilityHint,
  style,
  testID,
}: ActionCardProps) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint ?? description}
      accessibilityLabel={title}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.card, disabled && styles.disabled, pressed && !disabled && styles.pressed, style]}
      testID={testID}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <View style={styles.copy}>
        <Text maxFontSizeMultiplier={1.45} style={styles.title}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={1.5} style={styles.description}>
          {description}
        </Text>
      </View>
      <Text accessibilityElementsHidden style={styles.chevron}>
        ›
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 96,
    borderRadius: medicareRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: medicareSpacing.md,
    padding: medicareSpacing.md,
    backgroundColor: medicareColors.surfaceElevated,
    borderWidth: 1,
    borderColor: medicareColors.border,
    ...medicareShadow,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: medicareColors.primaryContainer,
  },
  copy: {
    flex: 1,
    gap: medicareSpacing.xxs,
  },
  title: {
    color: medicareColors.text,
    fontSize: medicareTypography.label,
    fontWeight: '800',
    lineHeight: 24,
  },
  description: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.bodySmall,
    lineHeight: 23,
  },
  chevron: {
    color: medicareColors.primary,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.74,
    backgroundColor: medicareColors.surfaceMuted,
  },
  disabled: {
    opacity: 0.6,
  },
});

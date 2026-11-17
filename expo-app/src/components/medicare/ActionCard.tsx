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
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ActionCard({
  title,
  description,
  icon,
  onPress,
  accessibilityHint,
  style,
  testID,
}: ActionCardProps) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint ?? description}
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
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
    minHeight: 88,
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
    width: 52,
    height: 52,
    borderRadius: 26,
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
    fontWeight: '700',
    lineHeight: 23,
  },
  description: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.bodySmall,
    lineHeight: 22,
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
});

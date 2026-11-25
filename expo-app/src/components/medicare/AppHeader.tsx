import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  medicareAccessibility,
  medicareColors,
  medicareSpacing,
  medicareTypography,
} from '@/constants/medicare-theme';

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backAccessibilityLabel?: string;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AppHeader({
  title,
  subtitle,
  onBack,
  backAccessibilityLabel,
  right,
  style,
}: AppHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      {onBack ? (
        <Pressable
          accessibilityHint="Quay lại màn hình trước"
          accessibilityLabel={backAccessibilityLabel ?? 'Back'}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <Text accessibilityElementsHidden style={styles.backIcon}>
            ‹
          </Text>
        </Pressable>
      ) : null}
      <View style={styles.copy}>
        <Text maxFontSizeMultiplier={1.5} style={styles.title}>
          {title}
        </Text>
        {subtitle ? (
          <Text maxFontSizeMultiplier={1.5} style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: medicareAccessibility.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: medicareSpacing.sm,
  },
  backButton: {
    width: medicareAccessibility.minTouchTarget,
    height: medicareAccessibility.minTouchTarget,
    borderRadius: medicareAccessibility.minTouchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: medicareColors.surfaceMuted,
  },
  backIcon: {
    color: medicareColors.primary,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: '500',
  },
  copy: {
    flex: 1,
    gap: medicareSpacing.xxs,
  },
  title: {
    color: medicareColors.text,
    fontSize: medicareTypography.subheading,
    fontWeight: '700',
    lineHeight: 29,
  },
  subtitle: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.bodySmall,
    lineHeight: 23,
  },
  right: {
    marginLeft: 'auto',
  },
  pressed: {
    opacity: 0.72,
  },
});

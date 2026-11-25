import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';

import {
  medicareColors,
  medicareRadius,
  medicareSpacing,
  medicareTypography,
} from '@/constants/medicare-theme';

export type SafetyNoticeTone = 'warning' | 'error' | 'information';

export type SafetyNoticeProps = {
  title: string;
  message: string;
  tone?: SafetyNoticeTone;
  style?: StyleProp<ViewStyle>;
};

export function SafetyNotice({ title, message, tone = 'warning', style }: SafetyNoticeProps) {
  const palette = tonePalettes[tone];

  return (
    <View accessibilityRole="alert" style={[styles.container, palette.container, style]}>
      <Text maxFontSizeMultiplier={1.5} style={[styles.title, palette.text]}>
        {title}
      </Text>
      <Text maxFontSizeMultiplier={1.5} style={[styles.message, palette.text]}>
        {message}
      </Text>
    </View>
  );
}

const tonePalettes = {
  warning: {
    container: {
      borderColor: '#E8C77F',
      backgroundColor: '#FFF8E9',
    },
    text: { color: '#674B16' },
  },
  error: {
    container: {
      borderColor: '#E8B4AE',
      backgroundColor: '#FFF2F0',
    },
    text: { color: medicareColors.onErrorContainer },
  },
  information: {
    container: {
      borderColor: '#D2DFEF',
      backgroundColor: '#F0F5FB',
    },
    text: { color: medicareColors.onSecondaryContainer },
  },
} as const;

const styles = StyleSheet.create({
  container: {
    gap: medicareSpacing.xxs,
    borderRadius: medicareRadius.md,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: medicareSpacing.md,
  },
  title: {
    fontSize: medicareTypography.label,
    fontWeight: '700',
    lineHeight: 23,
  },
  message: {
    fontSize: medicareTypography.bodySmall,
    lineHeight: 22,
  },
});

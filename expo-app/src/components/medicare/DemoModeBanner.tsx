import { StyleSheet, Text, View } from 'react-native';

import {
  medicareColors,
  medicareRadius,
  medicareSpacing,
  medicareTypography,
} from '@/constants/medicare-theme';

export type DemoModeBannerProps = {
  title: string;
  description: string;
};

/** Communicates demo-only state without relying on color alone. */
export function DemoModeBanner({ title, description }: DemoModeBannerProps) {
  return (
    <View accessibilityRole="summary" style={styles.container}>
      <Text maxFontSizeMultiplier={1.5} style={styles.title}>
        {title}
      </Text>
      <Text maxFontSizeMultiplier={1.5} style={styles.description}>
        {description}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: medicareSpacing.xs,
    padding: medicareSpacing.md,
    borderRadius: medicareRadius.lg,
    borderWidth: 1,
    borderColor: '#D2DFEF',
    backgroundColor: '#F0F5FB',
  },
  title: {
    color: medicareColors.onSecondaryContainer,
    fontSize: medicareTypography.label,
    fontWeight: '800',
    lineHeight: 24,
  },
  description: {
    color: medicareColors.onSecondaryContainer,
    fontSize: medicareTypography.bodySmall,
    lineHeight: 22,
  },
});

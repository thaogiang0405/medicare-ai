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
    gap: medicareSpacing.xxs,
    padding: medicareSpacing.md,
    borderRadius: medicareRadius.md,
    borderWidth: 1,
    borderColor: medicareColors.secondary,
    backgroundColor: medicareColors.secondaryContainer,
  },
  title: {
    color: medicareColors.onSecondaryContainer,
    fontSize: medicareTypography.label,
    fontWeight: '700',
    lineHeight: 23,
  },
  description: {
    color: medicareColors.onSecondaryContainer,
    fontSize: medicareTypography.bodySmall,
    lineHeight: 22,
  },
});

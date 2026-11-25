import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Screen } from '@/components/medicare';
import { medicareColors, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';

/** First-use splash. It contains no authentication or remote-data behaviour. */
export default function SplashScreen() {
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      router.replace('/onboarding');
    }, 700);

    return () => clearTimeout(timeoutId);
  }, []);

  return (
    <Screen contentStyle={styles.content} scroll={false} testID="splash-screen">
      <View accessibilityRole="summary" style={styles.brandBlock}>
        <View accessibilityElementsHidden style={styles.mark}>
          <Text style={styles.markText}>+</Text>
        </View>
        <Text maxFontSizeMultiplier={1.35} style={styles.title}>
          MediCare AI
        </Text>
        <Text maxFontSizeMultiplier={1.5} style={styles.subtitle}>
          Trợ lý quản lý thuốc và chăm sóc người cao tuổi
        </Text>
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.loading}>
        Đang chuẩn bị ứng dụng…
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: medicareSpacing.xxl,
  },
  brandBlock: {
    alignItems: 'center',
    gap: medicareSpacing.md,
    maxWidth: 330,
  },
  mark: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: medicareColors.primary,
  },
  markText: {
    color: medicareColors.onPrimary,
    fontSize: 62,
    fontWeight: '300',
    lineHeight: 70,
  },
  title: {
    color: medicareColors.primary,
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.body,
    lineHeight: medicareTypography.lineHeightBody,
    textAlign: 'center',
  },
  loading: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.bodySmall,
  },
});

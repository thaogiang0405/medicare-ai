import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/medicare';
import {
  FirebaseConfigurationError,
  FirebaseInitializationError,
  getFirebaseApp,
} from '@/services/firebase';
import { medicareColors, medicareRadius, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';

function toInitializationError(error: unknown): Error {
  if (error instanceof FirebaseConfigurationError || error instanceof FirebaseInitializationError) {
    return error;
  }

  return new FirebaseInitializationError(error);
}

/**
 * Starts Firebase Core before any route is shown. A configuration error blocks
 * the demo UI visibly instead of silently treating Firebase as optional.
 */
export function FirebaseInitializationGate({ children }: PropsWithChildren) {
  const [initializationError] = useState<Error | null>(() => {
    try {
      getFirebaseApp();
      return null;
    } catch (error) {
      return toInitializationError(error);
    }
  });

  if (!initializationError) {
    return <>{children}</>;
  }

  return (
    <Screen contentStyle={styles.content} scroll={false} testID="firebase-initialization-error">
      <View accessibilityRole="alert" style={styles.card}>
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.35} style={styles.title}>
          Không thể khởi tạo Firebase
        </Text>
        <Text maxFontSizeMultiplier={1.5} style={styles.body}>
          Ứng dụng dừng tại môi trường phát triển để không chạy với cấu hình Firebase chưa được xác minh.
        </Text>
        <Text maxFontSizeMultiplier={1.5} style={styles.details}>
          {initializationError.message}
        </Text>
        <Text maxFontSizeMultiplier={1.5} style={styles.body}>
          Kiểm tra file expo-app/.env rồi tải lại ứng dụng trong Expo Go.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    gap: medicareSpacing.md,
    padding: medicareSpacing.xl,
    borderRadius: medicareRadius.lg,
    backgroundColor: medicareColors.errorContainer,
  },
  title: {
    color: medicareColors.onErrorContainer,
    fontSize: medicareTypography.subheading,
    fontWeight: '800',
    lineHeight: medicareTypography.lineHeightHeading,
  },
  body: {
    color: medicareColors.onErrorContainer,
    fontSize: medicareTypography.body,
    lineHeight: medicareTypography.lineHeightBody,
  },
  details: {
    color: medicareColors.onErrorContainer,
    fontSize: medicareTypography.bodySmall,
    fontWeight: '700',
    lineHeight: medicareTypography.lineHeightBody,
  },
});

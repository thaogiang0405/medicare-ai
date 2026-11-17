import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/medicare';
import { getAuthRouteAccess } from '@/features/auth/presentation/auth-route-policy';
import { useSessionStore } from '@/store';
import { medicareColors, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';

/** Waits for Firebase Auth to restore persisted state before mounting routes. */
export function AuthInitializationGate({ children }: PropsWithChildren) {
  const authStatus = useSessionStore((state) => state.authStatus);
  const initializeAuthState = useSessionStore((state) => state.initializeAuthState);
  const routeAccess = getAuthRouteAccess(authStatus);

  useEffect(() => initializeAuthState(), [initializeAuthState]);

  if (!routeAccess.showInitializationGate) {
    return <>{children}</>;
  }

  return (
    <Screen contentStyle={styles.content} scroll={false} testID="auth-initialization-gate">
      <View accessibilityRole="summary" style={styles.message}>
        <ActivityIndicator accessibilityLabel="Đang kiểm tra trạng thái đăng nhập" color={medicareColors.primary} size="large" />
        <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.5} style={styles.text}>
          Đang kiểm tra phiên đăng nhập an toàn…
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
  message: {
    alignItems: 'center',
    gap: medicareSpacing.lg,
  },
  text: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.body,
    lineHeight: medicareTypography.lineHeightBody,
    textAlign: 'center',
  },
});

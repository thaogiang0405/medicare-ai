import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { PrimaryButton, Screen, SecondaryButton } from '@/components/medicare';
import { medicareColors, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';
import { getAuthRouteAccess } from '@/features/auth/presentation/auth-route-policy';
import { useSessionStore } from '@/store';

/** Waits for Auth and then the current user's Firestore profile before mounting routes. */
export function AuthInitializationGate({ children }: PropsWithChildren) {
  const authStatus = useSessionStore((state) => state.authStatus);
  const profileStatus = useSessionStore((state) => state.profileStatus);
  const user = useSessionStore((state) => state.user);
  const profileErrorMessage = useSessionStore((state) => state.profileErrorMessage);
  const initializeAuthState = useSessionStore((state) => state.initializeAuthState);
  const retryProfileLoad = useSessionStore((state) => state.retryProfileLoad);
  const signOut = useSessionStore((state) => state.signOut);
  const routeAccess = getAuthRouteAccess(authStatus, profileStatus, user?.role ?? null);

  useEffect(() => initializeAuthState(), [initializeAuthState]);

  if (routeAccess.showInitializationGate) {
    return (
      <Screen contentStyle={styles.content} scroll={false} testID="auth-initialization-gate">
        <View accessibilityRole="summary" style={styles.message}>
          <ActivityIndicator accessibilityLabel="Đang kiểm tra tài khoản và hồ sơ" color={medicareColors.primary} size="large" />
          <Text accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.5} style={styles.text}>
            Đang kiểm tra tài khoản và hồ sơ an toàn…
          </Text>
        </View>
      </Screen>
    );
  }

  if (routeAccess.showProfileError) {
    const isDisabled = profileStatus === 'disabled';

    const handleRetry = async () => {
      try {
        await retryProfileLoad();
      } catch {
        // The store exposes a safe Vietnamese message below.
      }
    };

    const handleSignOut = async () => {
      try {
        await signOut();
        router.replace('/login');
      } catch {
        // The session store exposes a safe localized error in the next login flow.
      }
    };

    return (
      <Screen contentStyle={styles.errorContent} scroll={false} testID="profile-initialization-error">
        <View accessibilityRole="alert" style={styles.message}>
          <Text accessibilityRole="header" style={styles.errorTitle}>
            {isDisabled ? 'Hồ sơ chưa sẵn sàng' : 'Không thể tải hồ sơ'}
          </Text>
          <Text accessibilityLiveRegion="polite" style={styles.text}>
            {profileErrorMessage ?? 'Không thể xác minh hồ sơ an toàn. Vui lòng thử lại.'}
          </Text>
        </View>
        <View style={styles.actions}>
          <PrimaryButton
            accessibilityHint="Thử tải lại hồ sơ của chính bạn"
            label="Thử lại"
            onPress={() => void handleRetry()}
          />
          <SecondaryButton
            accessibilityHint="Đăng xuất và quay lại màn hình đăng nhập"
            label="Đăng xuất"
            onPress={() => void handleSignOut()}
          />
        </View>
      </Screen>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: medicareSpacing.xl,
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
  errorTitle: {
    color: medicareColors.text,
    fontSize: medicareTypography.subheading,
    fontWeight: '800',
    lineHeight: 30,
    textAlign: 'center',
  },
  actions: {
    alignSelf: 'stretch',
    gap: medicareSpacing.sm,
  },
});

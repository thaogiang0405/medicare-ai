import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { medicareColors, medicareSpacing } from '@/constants/medicare-theme';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}>;

/** A consistent, safe-area-aware page shell with generous default padding. */
export function Screen({
  children,
  scroll = true,
  style,
  contentStyle,
  testID,
}: ScreenProps) {
  if (!scroll) {
    return (
      <SafeAreaView style={[styles.safeArea, style]} testID={testID}>
        <View style={[styles.content, styles.fill, contentStyle]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, style]} testID={testID}>
      <ScrollView
        contentContainerStyle={[styles.content, contentStyle]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: medicareColors.surface,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: medicareSpacing.page,
    paddingTop: medicareSpacing.lg,
    paddingBottom: medicareSpacing.xxl,
  },
  fill: {
    flex: 1,
  },
});

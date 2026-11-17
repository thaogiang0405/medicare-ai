import { StyleSheet, Text, View } from 'react-native';

import {
  medicareColors,
  medicareRadius,
  medicareSpacing,
  medicareTypography,
} from '@/constants/medicare-theme';

export type DoseStatus =
  | 'pending'
  | 'reportedTaken'
  | 'reportedSkipped'
  | 'snoozed'
  | 'unanswered';

export type StatusBadgeProps = {
  status: DoseStatus;
  label?: string;
};

const defaultLabels: Record<DoseStatus, string> = {
  pending: 'Đang chờ',
  reportedTaken: 'Đã báo đã uống',
  reportedSkipped: 'Đã báo bỏ qua',
  snoozed: 'Đã nhắc lại',
  unanswered: 'Chưa phản hồi',
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const palette = statusPalettes[status];
  const badgeLabel = label ?? defaultLabels[status];

  return (
    <View accessibilityLabel={badgeLabel} accessibilityRole="text" style={[styles.badge, palette]}>
      <Text maxFontSizeMultiplier={1.35} style={[styles.label, palette.text]}>
        {badgeLabel}
      </Text>
    </View>
  );
}

const statusPalettes = {
  pending: {
    backgroundColor: medicareColors.warningContainer,
    borderColor: medicareColors.warning,
    text: { color: medicareColors.warning },
  },
  reportedTaken: {
    backgroundColor: medicareColors.successContainer,
    borderColor: medicareColors.success,
    text: { color: medicareColors.success },
  },
  reportedSkipped: {
    backgroundColor: medicareColors.errorContainer,
    borderColor: medicareColors.error,
    text: { color: medicareColors.onErrorContainer },
  },
  snoozed: {
    backgroundColor: medicareColors.secondaryContainer,
    borderColor: medicareColors.secondary,
    text: { color: medicareColors.onSecondaryContainer },
  },
  unanswered: {
    backgroundColor: medicareColors.surfaceMuted,
    borderColor: medicareColors.border,
    text: { color: medicareColors.textMuted },
  },
} as const;

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: medicareRadius.pill,
    borderWidth: 1,
    paddingHorizontal: medicareSpacing.sm,
    paddingVertical: medicareSpacing.xs,
  },
  label: {
    fontSize: medicareTypography.caption,
    fontWeight: '700',
    lineHeight: 18,
  },
});

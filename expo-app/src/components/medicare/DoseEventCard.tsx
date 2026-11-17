import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';

import {
  medicareColors,
  medicareRadius,
  medicareShadow,
  medicareSpacing,
  medicareTypography,
} from '@/constants/medicare-theme';

import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';
import { StatusBadge, type DoseStatus } from './StatusBadge';

export type DoseEventCardProps = {
  medicationName: string;
  strengthText: string;
  scheduledText: string;
  status: DoseStatus;
  statusLabel?: string;
  reportedTakenAction?: { label: string; onPress: () => void };
  reportedSkippedAction?: { label: string; onPress: () => void };
  snoozeAction?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
};

/**
 * A self-reporting medication card. It deliberately says “reported” rather
 * than asserting clinical adherence.
 */
export function DoseEventCard({
  medicationName,
  strengthText,
  scheduledText,
  status,
  statusLabel,
  reportedTakenAction,
  reportedSkippedAction,
  snoozeAction,
  style,
}: DoseEventCardProps) {
  const canRespond = status === 'pending' || status === 'unanswered' || status === 'snoozed';

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text maxFontSizeMultiplier={1.45} style={styles.name}>
            {medicationName}
          </Text>
          <Text maxFontSizeMultiplier={1.5} style={styles.details}>
            {strengthText}
          </Text>
        </View>
        <StatusBadge label={statusLabel} status={status} />
      </View>
      <Text maxFontSizeMultiplier={1.5} style={styles.schedule}>
        {scheduledText}
      </Text>
      {canRespond ? (
        <View style={styles.actions}>
          {reportedTakenAction ? (
            <PrimaryButton
              label={reportedTakenAction.label}
              onPress={reportedTakenAction.onPress}
            />
          ) : null}
          {reportedSkippedAction ? (
            <SecondaryButton
              label={reportedSkippedAction.label}
              onPress={reportedSkippedAction.onPress}
            />
          ) : null}
          {snoozeAction ? (
            <SecondaryButton label={snoozeAction.label} onPress={snoozeAction.onPress} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: medicareSpacing.md,
    padding: medicareSpacing.lg,
    borderRadius: medicareRadius.lg,
    borderWidth: 1,
    borderColor: medicareColors.border,
    backgroundColor: medicareColors.surfaceElevated,
    ...medicareShadow,
  },
  header: {
    flexDirection: 'row',
    gap: medicareSpacing.sm,
    alignItems: 'flex-start',
  },
  copy: {
    flex: 1,
    gap: medicareSpacing.xxs,
  },
  name: {
    color: medicareColors.text,
    fontSize: medicareTypography.subheading,
    fontWeight: '700',
    lineHeight: 29,
  },
  details: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.body,
    lineHeight: medicareTypography.lineHeightBody,
  },
  schedule: {
    color: medicareColors.primary,
    fontSize: medicareTypography.label,
    fontWeight: '700',
    lineHeight: 23,
  },
  actions: {
    gap: medicareSpacing.sm,
  },
});

import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';

import {
  medicareColors,
  medicareRadius,
  medicareShadow,
  medicareSpacing,
  medicareTypography,
} from '@/constants/medicare-theme';

export type MedicationScheduleCardProps = {
  localTime: string;
  medicationName: string;
  strengthText: string;
  recurrenceText: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * A planned medication schedule, deliberately separate from a DoseEvent.
 * It has no adherence actions because M3.3.1 does not create dose records.
 */
export function MedicationScheduleCard({
  localTime,
  medicationName,
  strengthText,
  recurrenceText,
  style,
  testID,
}: MedicationScheduleCardProps) {
  return (
    <View
      accessibilityLabel={`Lịch dự kiến lúc ${localTime}: ${medicationName}, ${strengthText}, ${recurrenceText}. Chưa ghi nhận uống.`}
      style={[styles.card, style]}
      testID={testID}>
      <View style={styles.header}>
        <Text maxFontSizeMultiplier={1.5} style={styles.time}>
          {localTime}
        </Text>
        <View style={styles.copy}>
          <Text maxFontSizeMultiplier={1.45} style={styles.name}>
            {medicationName}
          </Text>
          <Text maxFontSizeMultiplier={1.5} style={styles.details}>
            {strengthText}
          </Text>
        </View>
      </View>
      <Text maxFontSizeMultiplier={1.5} style={styles.recurrence}>
        {recurrenceText}
      </Text>
      <Text maxFontSizeMultiplier={1.5} style={styles.notice}>
        Lịch dự kiến – Chưa ghi nhận uống
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: medicareSpacing.sm,
    padding: medicareSpacing.lg,
    borderRadius: medicareRadius.lg,
    borderWidth: 1,
    borderColor: medicareColors.border,
    backgroundColor: medicareColors.surfaceElevated,
    ...medicareShadow,
  },
  header: {
    flexDirection: 'row',
    gap: medicareSpacing.md,
    alignItems: 'flex-start',
  },
  time: {
    minWidth: 60,
    color: medicareColors.primary,
    fontSize: medicareTypography.subheading,
    fontWeight: '800',
    lineHeight: 29,
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
  recurrence: {
    color: medicareColors.primary,
    fontSize: medicareTypography.label,
    fontWeight: '700',
    lineHeight: 23,
  },
  notice: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.bodySmall,
    lineHeight: 22,
  },
});

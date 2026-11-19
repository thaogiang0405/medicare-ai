import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, type Href, useLocalSearchParams } from 'expo-router';

import {
  AppHeader,
  DemoModeBanner,
  PrimaryButton,
  SafetyNotice,
  Screen,
  SecondaryButton,
  TextField,
} from '@/components/medicare';
import {
  medicareAccessibility,
  medicareColors,
  medicareRadius,
  medicareSpacing,
  medicareTypography,
} from '@/constants/medicare-theme';
import { useMedicationManagement } from '@/features/medications/presentation/useMedicationManagement';
import { isFirestoreSchedulesFeatureEnabled } from '@/services/firebase/firestore-schedule-feature';
import type {
  MedicationSchedule,
  MedicationScheduleRecurrence,
  MedicationScheduleWeekday,
} from '@/types/domain';

import {
  getMedicationScheduleToday,
  type MedicationScheduleInputErrors,
  MedicationScheduleValidationError,
  validateMedicationScheduleDraft,
} from '../domain/medication-schedule-validation';
import { allMedicationScheduleWeekdays } from '../domain/medication-schedule-repository';
import { medicationScheduleWeekdayLabel } from './medication-schedule-utils';
import { useMedicationSchedules } from './useMedicationSchedules';

type FormState = Readonly<{
  recurrence: MedicationScheduleRecurrence;
  localTime: string;
  weekdays: MedicationScheduleWeekday[];
  startDate: string;
  endDate: string;
}>;

function resolveParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function initialFormState(): FormState {
  return {
    recurrence: 'daily',
    localTime: '',
    weekdays: [...allMedicationScheduleWeekdays],
    startDate: getMedicationScheduleToday(),
    endDate: '',
  };
}

function formStateFromSchedule(schedule: MedicationSchedule): FormState {
  return {
    recurrence: schedule.recurrence,
    localTime: schedule.localTime,
    weekdays: [...schedule.weekdays],
    startDate: schedule.startDate,
    endDate: schedule.endDate ?? '',
  };
}

export default function MedicationScheduleFormScreen() {
  const { medicationId, scheduleId } = useLocalSearchParams<{
    medicationId?: string | string[];
    scheduleId?: string | string[];
  }>();
  const resolvedMedicationId = resolveParam(medicationId);
  const resolvedScheduleId = resolveParam(scheduleId);
  const isEditing = Boolean(resolvedScheduleId);
  const { medications, listStatus: medicationListStatus } = useMedicationManagement();
  const {
    activeUserId,
    schedules,
    listStatus,
    operationStatus,
    errorMessage,
    createSchedule,
    updateSchedule,
    clearError,
  } = useMedicationSchedules();
  const [fieldErrors, setFieldErrors] = useState<MedicationScheduleInputErrors>({});
  const [editedForm, setEditedForm] = useState<Readonly<{ identity: string; value: FormState }> | null>(null);
  const medication = medications.find((item) => item.id === resolvedMedicationId);
  const existingSchedule = schedules.find((item) => item.id === resolvedScheduleId);
  const schedulesUseFirestore = isFirestoreSchedulesFeatureEnabled();
  const isLoading = !activeUserId || listStatus === 'loading' || medicationListStatus === 'loading';
  const isSaving = operationStatus === 'loading';
  const formIdentity = isEditing ? `edit:${resolvedScheduleId}` : `new:${resolvedMedicationId ?? ''}`;
  const form = editedForm?.identity === formIdentity
    ? editedForm.value
    : existingSchedule
      ? formStateFromSchedule(existingSchedule)
      : initialFormState();
  const updateForm = (updater: (current: FormState) => FormState) => {
    setEditedForm({ identity: formIdentity, value: updater(form) });
  };

  const goToList = () => {
    if (!resolvedMedicationId) {
      router.replace('/elderly/medications');
      return;
    }

    router.replace({
      pathname: '/elderly/medications/[medicationId]/schedules',
      params: { medicationId: resolvedMedicationId },
    } as unknown as Href);
  };

  const setRecurrence = (recurrence: MedicationScheduleRecurrence) => {
    clearError();
    setFieldErrors({});
    updateForm((current) => ({
      ...current,
      recurrence,
      weekdays: recurrence === 'daily' ? [...allMedicationScheduleWeekdays] : current.weekdays,
    }));
  };

  const toggleWeekday = (weekday: MedicationScheduleWeekday) => {
    if (form.recurrence === 'daily') {
      return;
    }

    clearError();
    setFieldErrors({});
    updateForm((current) => {
      const isSelected = current.weekdays.includes(weekday);
      const weekdays = isSelected
        ? current.weekdays.filter((item) => item !== weekday)
        : [...current.weekdays, weekday].sort((left, right) => left - right);
      return { ...current, weekdays };
    });
  };

  const handleSave = async () => {
    if (!resolvedMedicationId || !medication || isSaving) {
      return;
    }

    const draft = {
      recurrence: form.recurrence,
      localTime: form.localTime,
      weekdays: form.weekdays,
      startDate: form.startDate,
      endDate: form.endDate.trim() || null,
    };
    const validationErrors = validateMedicationScheduleDraft(draft);

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      return;
    }

    setFieldErrors({});
    clearError();

    try {
      if (isEditing && resolvedScheduleId) {
        await updateSchedule(resolvedScheduleId, draft);
      } else {
        if (medication.status !== 'active') {
          setFieldErrors({ medicationId: 'Chỉ có thể tạo lịch cho thuốc đang sử dụng.' });
          return;
        }

        await createSchedule({ medicationId: medication.id, ...draft });
      }

      goToList();
    } catch (error) {
      if (error instanceof MedicationScheduleValidationError) {
        setFieldErrors(error.fieldErrors);
      }
    }
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (!resolvedMedicationId || !medication || (isEditing && (!existingSchedule || existingSchedule.medicationId !== resolvedMedicationId))) {
    return <MissingState onBack={goToList} />;
  }

  if (!isEditing && medication.status !== 'active') {
    return <InactiveMedicationState onBack={goToList} />;
  }

  return (
    <Screen contentStyle={styles.content} testID="medication-schedule-form-screen">
      <AppHeader
        backAccessibilityLabel="Quay lại danh sách lịch uống"
        onBack={goToList}
        subtitle={medication.name}
        title={isEditing ? 'Chỉnh sửa lịch uống' : 'Thêm lịch uống'}
      />
      <DemoModeBanner
        description={schedulesUseFirestore
          ? 'Lịch này chỉ thuộc hồ sơ Firebase hiện tại. Lưu lịch không tạo nhắc uống hoặc DoseEvent.'
          : 'Lịch này chỉ lưu tạm trong phiên hiện tại. Lưu lịch không tạo nhắc uống hoặc DoseEvent.'}
        title={schedulesUseFirestore ? 'Lịch trên Firebase' : 'Chế độ trình diễn'}
      />
      <SafetyNotice
        message="Không tự suy luận giờ uống từ tên thuốc hoặc hướng dẫn. Chỉ nhập thông tin đã được bạn hoặc nhân viên y tế xác nhận."
        title="Nhập theo hướng dẫn có sẵn"
        tone="information"
      />
      {errorMessage ? <SafetyNotice message={errorMessage} title="Không thể lưu lịch" tone="error" /> : null}
      {fieldErrors.medicationId ? <SafetyNotice message={fieldErrors.medicationId} title="Không thể tạo lịch" tone="error" /> : null}
      <View accessibilityLabel="Kiểu lặp lại" accessibilityRole="radiogroup" style={styles.group}>
        <Text accessibilityRole="header" style={styles.groupLabel}>Lặp lại</Text>
        <View style={styles.choiceRow}>
          <ChoiceButton
            label="Mỗi ngày"
            onPress={() => setRecurrence('daily')}
            selected={form.recurrence === 'daily'}
          />
          <ChoiceButton
            label="Theo thứ"
            onPress={() => setRecurrence('weekly')}
            selected={form.recurrence === 'weekly'}
          />
        </View>
        {fieldErrors.recurrence ? <FieldError message={fieldErrors.recurrence} /> : null}
      </View>
      <TextField
        accessibilityHint="Nhập giờ địa phương theo dạng 08:00"
        errorMessage={fieldErrors.localTime}
        keyboardType="numbers-and-punctuation"
        label="Giờ uống (HH:mm)"
        maxLength={5}
        onChangeText={(localTime) => {
          clearError();
          setFieldErrors({});
          updateForm((current) => ({ ...current, localTime }));
        }}
        placeholder="Ví dụ: 08:00"
        value={form.localTime}
      />
      <View accessibilityLabel="Các thứ trong tuần" style={styles.group}>
        <Text accessibilityRole="header" style={styles.groupLabel}>Ngày lặp lại</Text>
        <Text style={styles.helperText}>
          {form.recurrence === 'daily'
            ? 'Lịch hằng ngày đã chọn đủ bảy ngày.'
            : 'Chọn một hoặc nhiều thứ theo hướng dẫn của bạn.'}
        </Text>
        <View style={styles.weekdayGrid}>
          {allMedicationScheduleWeekdays.map((weekday) => {
            const selected = form.weekdays.includes(weekday);
            const disabled = form.recurrence === 'daily';

            return (
              <Pressable
                accessibilityLabel={`Chọn ${medicationScheduleWeekdayLabel(weekday)}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected, disabled }}
                disabled={disabled}
                key={weekday}
                onPress={() => toggleWeekday(weekday)}
                style={({ pressed }) => [
                  styles.weekdayButton,
                  selected && styles.weekdayButtonSelected,
                  disabled && styles.weekdayButtonDisabled,
                  pressed && !disabled && styles.weekdayButtonPressed,
                ]}>
                <Text style={[styles.weekdayLabel, selected && styles.weekdayLabelSelected]}>
                  {medicationScheduleWeekdayLabel(weekday)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {fieldErrors.weekdays ? <FieldError message={fieldErrors.weekdays} /> : null}
      </View>
      <TextField
        accessibilityHint="Nhập ngày bắt đầu theo dạng năm-tháng-ngày"
        errorMessage={fieldErrors.startDate}
        label="Ngày bắt đầu (YYYY-MM-DD)"
        maxLength={10}
        onChangeText={(startDate) => {
          clearError();
          setFieldErrors({});
          updateForm((current) => ({ ...current, startDate }));
        }}
        placeholder="Ví dụ: 2026-11-19"
        value={form.startDate}
      />
      <TextField
        accessibilityHint="Không bắt buộc. Nhập ngày kết thúc theo dạng năm-tháng-ngày nếu lịch có thời hạn"
        errorMessage={fieldErrors.endDate}
        helperText="Để trống nếu chưa xác định ngày kết thúc."
        label="Ngày kết thúc (tùy chọn)"
        maxLength={10}
        onChangeText={(endDate) => {
          clearError();
          setFieldErrors({});
          updateForm((current) => ({ ...current, endDate }));
        }}
        placeholder="Ví dụ: 2026-12-31"
        value={form.endDate}
      />
      <SafetyNotice
        message="Múi giờ cố định: Asia/Ho_Chi_Minh. Không có thông báo, lập lịch nền hoặc DoseEvent thật trong M3.3."
        title="Thời gian địa phương"
        tone="information"
      />
      <View style={styles.actions}>
        <PrimaryButton
          disabled={isSaving}
          label={isSaving ? 'Đang lưu…' : isEditing ? 'Lưu thay đổi' : 'Lưu lịch uống'}
          onPress={() => void handleSave()}
          testID="save-medication-schedule-button"
        />
        <SecondaryButton disabled={isSaving} label="Hủy" onPress={goToList} />
      </View>
    </Screen>
  );
}

function ChoiceButton({ label, selected, onPress }: Readonly<{
  label: string;
  selected: boolean;
  onPress: () => void;
}>) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.choiceButton, selected && styles.choiceButtonSelected, pressed && styles.choiceButtonPressed]}>
      <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

function FieldError({ message }: Readonly<{ message: string }>) {
  return <Text accessibilityLiveRegion="assertive" style={styles.fieldError}>{message}</Text>;
}

function LoadingState() {
  return (
    <Screen contentStyle={styles.loadingContent} scroll={false}>
      <ActivityIndicator accessibilityLabel="Đang tải lịch uống thuốc" color={medicareColors.primary} size="large" />
      <Text style={styles.loadingText}>Đang tải lịch uống thuốc…</Text>
    </Screen>
  );
}

function MissingState({ onBack }: Readonly<{ onBack: () => void }>) {
  return (
    <Screen contentStyle={styles.content}>
      <AppHeader backAccessibilityLabel="Quay lại danh sách lịch uống" onBack={onBack} title="Không tìm thấy lịch" />
      <SafetyNotice
        message="Không thể mở biểu mẫu vì thuốc hoặc lịch không thuộc tài khoản hiện tại."
        title="Không thể mở lịch"
        tone="error"
      />
      <PrimaryButton label="Quay lại" onPress={onBack} />
    </Screen>
  );
}

function InactiveMedicationState({ onBack }: Readonly<{ onBack: () => void }>) {
  return (
    <Screen contentStyle={styles.content}>
      <AppHeader backAccessibilityLabel="Quay lại danh sách lịch uống" onBack={onBack} title="Không thể thêm lịch" />
      <SafetyNotice
        message="Chỉ có thể tạo lịch mới cho thuốc đang sử dụng. Việc này không thay thế hướng dẫn của bác sĩ hoặc dược sĩ."
        title="Thuốc đã ngừng sử dụng"
        tone="information"
      />
      <PrimaryButton label="Quay lại danh sách lịch" onPress={onBack} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: medicareSpacing.lg,
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: medicareSpacing.md,
  },
  loadingText: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.body,
    lineHeight: medicareTypography.lineHeightBody,
    textAlign: 'center',
  },
  group: {
    gap: medicareSpacing.xs,
  },
  groupLabel: {
    color: medicareColors.text,
    fontSize: medicareTypography.label,
    fontWeight: '700',
    lineHeight: 23,
  },
  helperText: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.bodySmall,
    lineHeight: 22,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: medicareSpacing.sm,
  },
  choiceButton: {
    minHeight: medicareAccessibility.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: medicareColors.border,
    borderRadius: medicareRadius.md,
    paddingHorizontal: medicareSpacing.md,
    backgroundColor: medicareColors.surfaceElevated,
  },
  choiceButtonSelected: {
    borderColor: medicareColors.primary,
    backgroundColor: medicareColors.primaryContainer,
  },
  choiceButtonPressed: {
    opacity: 0.76,
  },
  choiceLabel: {
    color: medicareColors.text,
    fontSize: medicareTypography.bodySmall,
    fontWeight: '700',
  },
  choiceLabelSelected: {
    color: medicareColors.onPrimaryContainer,
  },
  weekdayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: medicareSpacing.xs,
  },
  weekdayButton: {
    minHeight: medicareAccessibility.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: medicareColors.border,
    borderRadius: medicareRadius.md,
    paddingHorizontal: medicareSpacing.sm,
    backgroundColor: medicareColors.surfaceElevated,
  },
  weekdayButtonSelected: {
    borderColor: medicareColors.primary,
    backgroundColor: medicareColors.primaryContainer,
  },
  weekdayButtonDisabled: {
    opacity: 0.78,
  },
  weekdayButtonPressed: {
    opacity: 0.76,
  },
  weekdayLabel: {
    color: medicareColors.text,
    fontSize: medicareTypography.caption,
    fontWeight: '800',
  },
  weekdayLabelSelected: {
    color: medicareColors.onPrimaryContainer,
  },
  fieldError: {
    color: medicareColors.error,
    fontSize: medicareTypography.bodySmall,
    fontWeight: '600',
    lineHeight: 22,
  },
  actions: {
    gap: medicareSpacing.sm,
  },
});

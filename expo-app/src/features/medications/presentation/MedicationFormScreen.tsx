import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import {
  AppHeader,
  DemoModeBanner,
  PrimaryButton,
  SafetyNotice,
  Screen,
  SecondaryButton,
  TextField,
} from '@/components/medicare';
import { medicareColors, medicareSpacing, medicareTypography } from '@/constants/medicare-theme';
import {
  MedicationValidationError,
  validateMedicationInput,
  type MedicationInputErrors,
} from '@/features/medications/domain/medication-validation';
import { medicationFieldLimits, type MedicationInput } from '@/features/medications/domain/medication-repository';
import type { Medication } from '@/types/domain';

import { useMedicationManagement } from './useMedicationManagement';

type MedicationFormMode = 'create' | 'edit';

const emptyMedicationInput: MedicationInput = {
  name: '',
  strengthText: '',
  directionsText: '',
};

function toMedicationInput(medication: Medication | undefined): MedicationInput {
  return medication
    ? {
        name: medication.name,
        strengthText: medication.strengthText,
        directionsText: medication.directionsText,
      }
    : emptyMedicationInput;
}

function medicationDetailRoute(medicationId: string) {
  return {
    pathname: '/elderly/medications/[medicationId]' as const,
    params: { medicationId },
  };
}

function MedicationForm({ mode, medication }: Readonly<{ mode: MedicationFormMode; medication?: Medication }>) {
  const { activeUserId, operationStatus, errorMessage, createMedication, updateMedication, clearError } =
    useMedicationManagement({ load: mode === 'create' });
  const [input, setInput] = useState<MedicationInput>(() => toMedicationInput(medication));
  const [fieldErrors, setFieldErrors] = useState<MedicationInputErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = mode === 'edit';
  const isSaving = isSubmitting || operationStatus === 'loading';

  const pageCopy = useMemo(
    () =>
      isEdit
        ? {
            title: 'Chỉnh sửa thuốc',
            subtitle: 'Chỉ sửa nội dung bạn đã ghi nhận',
            saveLabel: 'Lưu thay đổi',
            successTitle: 'Đã cập nhật thuốc',
            successMessage: 'Thông tin thuốc đã được cập nhật trong chế độ trình diễn.',
          }
        : {
            title: 'Thêm thuốc',
            subtitle: 'Ghi lại thông tin bạn cung cấp',
            saveLabel: 'Lưu thuốc',
            successTitle: 'Đã lưu thuốc',
            successMessage: 'Thuốc đã được thêm trong chế độ trình diễn.',
          },
    [isEdit],
  );

  const updateField = (field: keyof MedicationInput, value: string) => {
    clearError();
    setInput((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  const validateCurrentInput = (): boolean => {
    const errors = validateMedicationInput(input);
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (isSaving || !validateCurrentInput()) {
      return;
    }

    if (!activeUserId) {
      setFieldErrors({});
      return;
    }

    setIsSubmitting(true);

    try {
      const savedMedication = isEdit && medication
        ? await updateMedication(medication.id, input)
        : await createMedication(input);

      Alert.alert(pageCopy.successTitle, pageCopy.successMessage, [
        {
          text: 'Xem chi tiết',
          onPress: () => router.replace(medicationDetailRoute(savedMedication.id)),
        },
      ]);
    } catch (error) {
      if (error instanceof MedicationValidationError) {
        setFieldErrors(error.fieldErrors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (medication) {
      router.replace(medicationDetailRoute(medication.id));
      return;
    }

    router.replace('/elderly/medications');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoidingView}>
      <Screen contentStyle={styles.content} testID={`medication-${mode}-screen`}>
        <AppHeader
          backAccessibilityLabel={isEdit ? 'Quay lại chi tiết thuốc' : 'Quay lại danh sách thuốc'}
          onBack={handleCancel}
          subtitle={pageCopy.subtitle}
          title={pageCopy.title}
        />
        <DemoModeBanner
          description="Chỉ ghi lại tên, quy cách và hướng dẫn bạn cung cấp. Ứng dụng không suy luận liều, giờ uống hoặc tạo lịch nhắc."
          title="Chế độ trình diễn"
        />
        <View style={styles.form}>
          <TextField
            accessibilityHint="Bắt buộc. Nhập tên thuốc như bạn muốn ghi nhận"
            autoCapitalize="words"
            errorMessage={fieldErrors.name}
            label="Tên thuốc *"
            maxLength={medicationFieldLimits.name}
            onBlur={validateCurrentInput}
            onChangeText={(value) => updateField('name', value)}
            placeholder="Ví dụ: Metformin"
            returnKeyType="next"
            testID="medication-name-input"
            value={input.name}
          />
          <TextField
            accessibilityHint="Không bắt buộc. Ghi lại hàm lượng hoặc quy cách nếu bạn có thông tin"
            errorMessage={fieldErrors.strengthText}
            helperText="Không bắt buộc"
            label="Hàm lượng hoặc quy cách"
            maxLength={medicationFieldLimits.strengthText}
            onBlur={validateCurrentInput}
            onChangeText={(value) => updateField('strengthText', value)}
            placeholder="Ví dụ: 500 mg"
            returnKeyType="next"
            testID="medication-strength-input"
            value={input.strengthText}
          />
          <TextField
            accessibilityHint="Không bắt buộc. Chỉ ghi lại nguyên văn hướng dẫn bạn cung cấp"
            errorMessage={fieldErrors.directionsText}
            helperText="Không bắt buộc · Ứng dụng không tự tạo hướng dẫn sử dụng"
            label="Hướng dẫn sử dụng đã ghi nhận"
            maxLength={medicationFieldLimits.directionsText}
            multiline
            numberOfLines={4}
            onBlur={validateCurrentInput}
            onChangeText={(value) => updateField('directionsText', value)}
            placeholder="Ví dụ: Nội dung bạn đã xác nhận từ đơn thuốc"
            style={styles.multilineInput}
            testID="medication-directions-input"
            textAlignVertical="top"
            value={input.directionsText}
          />
          <SafetyNotice
            message="Thuốc mới được đánh dấu “Đang sử dụng” trong danh sách quản lý. Thao tác này không tạo lịch thuốc hoặc nhắc uống."
            title="Trạng thái ban đầu"
            tone="information"
          />
          {errorMessage ? <SafetyNotice message={errorMessage} title="Không thể lưu" tone="error" /> : null}
          {!activeUserId ? (
            <View accessibilityRole="progressbar" style={styles.waitingState}>
              <ActivityIndicator accessibilityLabel="Đang chuẩn bị biểu mẫu thuốc" color={medicareColors.primary} size="small" />
              <Text style={styles.waitingText}>Đang chuẩn bị thông tin tài khoản…</Text>
            </View>
          ) : null}
          <View style={styles.actions}>
            <PrimaryButton
              accessibilityHint="Lưu thông tin thuốc đã nhập trong chế độ trình diễn"
              disabled={!activeUserId}
              label={pageCopy.saveLabel}
              loading={isSaving}
              onPress={() => void handleSave()}
              testID="save-medication-button"
            />
            <SecondaryButton
              accessibilityHint="Không lưu thay đổi và quay lại màn hình trước"
              disabled={isSaving}
              label="Hủy"
              onPress={handleCancel}
            />
          </View>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

export function CreateMedicationScreen() {
  return <MedicationForm mode="create" />;
}

export function EditMedicationScreen() {
  const { medicationId } = useLocalSearchParams<{ medicationId?: string | string[] }>();
  const { activeUserId, medications, listStatus, errorMessage } = useMedicationManagement();
  const resolvedMedicationId = Array.isArray(medicationId) ? medicationId[0] : medicationId;
  const medication = medications.find((item) => item.id === resolvedMedicationId);

  if (!activeUserId || listStatus === 'loading' || listStatus === 'idle') {
    return <MedicationLoadingState title="Đang tải thuốc để chỉnh sửa" />;
  }

  if (!medication) {
    return <MedicationMissingState detail={errorMessage} />;
  }

  return <MedicationForm key={medication.id} medication={medication} mode="edit" />;
}

function MedicationLoadingState({ title }: Readonly<{ title: string }>) {
  return (
    <Screen contentStyle={styles.loadingContent} scroll={false}>
      <ActivityIndicator accessibilityLabel={title} color={medicareColors.primary} size="large" />
      <Text style={styles.waitingText}>{title}…</Text>
    </Screen>
  );
}

function MedicationMissingState({ detail }: Readonly<{ detail: string | null }>) {
  return (
    <Screen contentStyle={styles.content}>
      <AppHeader
        backAccessibilityLabel="Quay lại danh sách thuốc"
        onBack={() => router.replace('/elderly/medications')}
        title="Không tìm thấy thuốc"
      />
      <SafetyNotice
        message={detail ?? 'Bản ghi không tồn tại trong danh sách thuốc của tài khoản hiện tại.'}
        title="Không thể chỉnh sửa"
        tone="error"
      />
      <PrimaryButton label="Về danh sách thuốc" onPress={() => router.replace('/elderly/medications')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: {
    flex: 1,
  },
  content: {
    gap: medicareSpacing.lg,
  },
  form: {
    gap: medicareSpacing.lg,
  },
  multilineInput: {
    minHeight: 124,
  },
  actions: {
    gap: medicareSpacing.sm,
  },
  waitingState: {
    alignItems: 'center',
    gap: medicareSpacing.xs,
  },
  waitingText: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.body,
    lineHeight: medicareTypography.lineHeightBody,
    textAlign: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: medicareSpacing.md,
  },
});

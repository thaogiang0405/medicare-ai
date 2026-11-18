import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import {
  AppHeader,
  DemoModeBanner,
  PrimaryButton,
  SafetyNotice,
  Screen,
  StatusBadge,
  TextField,
} from '@/components/medicare';
import {
  medicareAccessibility,
  medicareColors,
  medicareRadius,
  medicareShadow,
  medicareSpacing,
  medicareTypography,
} from '@/constants/medicare-theme';
import type { MedicationListStatus } from '@/features/medications/domain/medication-repository';

import { filterVisibleMedications } from './medication-list-utils';
import { useMedicationManagement } from './useMedicationManagement';

type FilterOption = Readonly<{
  label: string;
  value: MedicationListStatus;
}>;

const filterOptions: readonly FilterOption[] = [
  { label: 'Tất cả', value: 'all' },
  { label: 'Đang dùng', value: 'active' },
  { label: 'Đã ngừng', value: 'inactive' },
];

function optionalText(value: string): string {
  return value || 'Chưa cung cấp';
}

export default function MedicationListScreen() {
  const {
    activeUserId,
    medications,
    listStatus,
    errorMessage,
    reload,
  } = useMedicationManagement();
  const [filter, setFilter] = useState<MedicationListStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const normalizedQuery = searchQuery.trim();

  const visibleMedications = useMemo(
    () => filterVisibleMedications(medications, filter, searchQuery),
    [filter, medications, searchQuery],
  );
  const isLoading = listStatus === 'loading' || !activeUserId;

  return (
    <Screen contentStyle={styles.content} testID="medication-list-screen">
      <AppHeader
        backAccessibilityLabel="Quay lại trang chủ"
        onBack={() => router.replace('/elderly')}
        subtitle="Danh sách được lưu tạm trong phiên hiện tại"
        title="Thuốc của tôi"
      />
      <DemoModeBanner
        description="Thông tin dưới đây là chế độ trình diễn theo tài khoản đang đăng nhập. Việc thêm hoặc sửa không tạo lịch uống và không lưu lên Firebase."
        title="Chế độ trình diễn"
      />
      <PrimaryButton
        accessibilityHint="Mở biểu mẫu để ghi lại một thuốc do bạn nhập"
        label="Thêm thuốc"
        onPress={() => router.push('/elderly/medications/new')}
        testID="add-medication-button"
      />
      <TextField
        accessibilityHint="Nhập một phần tên thuốc để lọc danh sách"
        label="Tìm theo tên thuốc"
        onChangeText={setSearchQuery}
        placeholder="Ví dụ: Metformin"
        returnKeyType="search"
        value={searchQuery}
      />
      <View accessibilityLabel="Lọc trạng thái thuốc" accessibilityRole="radiogroup" style={styles.filterGroup}>
        <Text accessibilityRole="header" style={styles.filterLabel}>
          Trạng thái
        </Text>
        <View style={styles.filterOptions}>
          {filterOptions.map((option) => {
            const isSelected = filter === option.value;

            return (
              <Pressable
                accessibilityLabel={`Lọc: ${option.label}`}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                key={option.value}
                onPress={() => setFilter(option.value)}
                style={({ pressed }) => [
                  styles.filterButton,
                  isSelected && styles.filterButtonSelected,
                  pressed && styles.filterButtonPressed,
                ]}>
                <Text style={[styles.filterButtonText, isSelected && styles.filterButtonTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {isLoading ? (
        <View accessibilityRole="progressbar" style={styles.stateContainer}>
          <ActivityIndicator accessibilityLabel="Đang tải danh sách thuốc" color={medicareColors.primary} size="large" />
          <Text style={styles.stateText}>Đang tải danh sách thuốc…</Text>
        </View>
      ) : null}
      {listStatus === 'error' ? (
        <View style={styles.stateGap}>
          <SafetyNotice
            message={errorMessage ?? 'Không thể tải danh sách thuốc demo.'}
            title="Không thể tải thuốc"
            tone="error"
          />
          <PrimaryButton
            accessibilityHint="Tải lại danh sách thuốc của tài khoản hiện tại"
            label="Thử lại"
            onPress={() => void reload()}
          />
        </View>
      ) : null}
      {listStatus === 'ready' && visibleMedications.length === 0 ? (
        <View accessibilityRole="summary" style={styles.emptyState}>
          <Text accessibilityRole="header" style={styles.emptyTitle}>
            Chưa có thuốc nào
          </Text>
          <Text style={styles.emptyDescription}>
            {normalizedQuery
              ? 'Không tìm thấy thuốc khớp với từ khóa đã nhập.'
              : filter === 'all'
                ? 'Bạn có thể thêm thông tin thuốc do mình cung cấp.'
                : 'Không có thuốc ở trạng thái đã chọn.'}
          </Text>
        </View>
      ) : null}
      {listStatus === 'ready' ? (
        <View style={styles.list}>
          {visibleMedications.map((medication) => (
            <Pressable
              accessibilityHint="Mở thông tin chi tiết và các thao tác quản lý thuốc"
              accessibilityLabel={`Xem chi tiết thuốc ${medication.name}`}
              accessibilityRole="button"
              key={medication.id}
              onPress={() =>
                router.push({
                  pathname: '/elderly/medications/[medicationId]',
                  params: { medicationId: medication.id },
                })
              }
              style={({ pressed }) => [styles.medicationCard, pressed && styles.medicationCardPressed]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardCopy}>
                  <Text maxFontSizeMultiplier={1.45} style={styles.medicationName}>
                    {medication.name}
                  </Text>
                  <Text maxFontSizeMultiplier={1.5} style={styles.medicationMeta}>
                    {optionalText(medication.strengthText)}
                  </Text>
                </View>
                <StatusBadge status={medication.status} />
              </View>
              <Text maxFontSizeMultiplier={1.5} style={styles.directionsLabel}>
                Hướng dẫn đã ghi
              </Text>
              <Text maxFontSizeMultiplier={1.5} style={styles.directionsText}>
                {optionalText(medication.directionsText)}
              </Text>
              <Text accessibilityElementsHidden style={styles.openDetail}>
                Xem chi tiết ›
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: medicareSpacing.lg,
  },
  filterGroup: {
    gap: medicareSpacing.xs,
  },
  filterLabel: {
    color: medicareColors.text,
    fontSize: medicareTypography.label,
    fontWeight: '700',
    lineHeight: 23,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: medicareSpacing.xs,
  },
  filterButton: {
    minHeight: medicareAccessibility.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: medicareColors.border,
    borderRadius: medicareRadius.md,
    paddingHorizontal: medicareSpacing.md,
    backgroundColor: medicareColors.surfaceElevated,
  },
  filterButtonSelected: {
    borderColor: medicareColors.primary,
    backgroundColor: medicareColors.primaryContainer,
  },
  filterButtonPressed: {
    opacity: 0.76,
  },
  filterButtonText: {
    color: medicareColors.text,
    fontSize: medicareTypography.bodySmall,
    fontWeight: '700',
  },
  filterButtonTextSelected: {
    color: medicareColors.onPrimaryContainer,
  },
  stateContainer: {
    alignItems: 'center',
    gap: medicareSpacing.md,
    paddingVertical: medicareSpacing.xxl,
  },
  stateGap: {
    gap: medicareSpacing.md,
  },
  stateText: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.body,
    lineHeight: medicareTypography.lineHeightBody,
    textAlign: 'center',
  },
  emptyState: {
    gap: medicareSpacing.xs,
    padding: medicareSpacing.lg,
    borderWidth: 1,
    borderColor: medicareColors.border,
    borderRadius: medicareRadius.lg,
    backgroundColor: medicareColors.surfaceMuted,
  },
  emptyTitle: {
    color: medicareColors.text,
    fontSize: medicareTypography.subheading,
    fontWeight: '800',
    lineHeight: 29,
  },
  emptyDescription: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.body,
    lineHeight: medicareTypography.lineHeightBody,
  },
  list: {
    gap: medicareSpacing.md,
  },
  medicationCard: {
    gap: medicareSpacing.sm,
    padding: medicareSpacing.lg,
    borderWidth: 1,
    borderColor: medicareColors.border,
    borderRadius: medicareRadius.lg,
    backgroundColor: medicareColors.surfaceElevated,
    ...medicareShadow,
  },
  medicationCardPressed: {
    backgroundColor: medicareColors.surfaceMuted,
    opacity: 0.8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: medicareSpacing.sm,
  },
  cardCopy: {
    flex: 1,
    gap: medicareSpacing.xxs,
  },
  medicationName: {
    color: medicareColors.text,
    fontSize: medicareTypography.subheading,
    fontWeight: '800',
    lineHeight: 29,
  },
  medicationMeta: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.body,
    lineHeight: medicareTypography.lineHeightBody,
  },
  directionsLabel: {
    color: medicareColors.textMuted,
    fontSize: medicareTypography.caption,
    fontWeight: '800',
    lineHeight: 18,
  },
  directionsText: {
    color: medicareColors.text,
    fontSize: medicareTypography.bodySmall,
    lineHeight: 23,
  },
  openDetail: {
    color: medicareColors.primary,
    fontSize: medicareTypography.bodySmall,
    fontWeight: '800',
    lineHeight: 23,
  },
});

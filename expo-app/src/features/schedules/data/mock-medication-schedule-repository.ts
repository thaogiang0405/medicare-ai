import type { MedicationSchedule } from '@/types/domain';

import {
  assertValidMedicationScheduleCreateInput,
  assertValidMedicationScheduleUpdateInput,
} from '../domain/medication-schedule-validation';
import type {
  MedicationScheduleCreateInput,
  MedicationScheduleListOptions,
  MedicationScheduleRepository,
  MedicationScheduleUpdateInput,
} from '../domain/medication-schedule-repository';

function cloneSchedule(schedule: MedicationSchedule): MedicationSchedule {
  return { ...schedule, weekdays: [...schedule.weekdays] };
}

function assertUserId(userId: string): string {
  const normalized = userId.trim();

  if (!normalized) {
    throw new Error('Không thể xác định tài khoản hiện tại. Vui lòng đăng nhập lại.');
  }

  return normalized;
}

function assertScheduleId(scheduleId: string): string {
  const normalized = scheduleId.trim();

  if (!normalized || normalized.includes('/')) {
    throw new Error('Mã lịch uống thuốc không hợp lệ.');
  }

  return normalized;
}

export type MockMedicationScheduleRepositoryOptions = Readonly<{
  now?: () => Date;
}>;

/**
 * M3.3 fallback for local UI testing. Records are deliberately isolated by
 * signed-in UID, remain in memory only, and never create DoseEvent records.
 */
export class MockMedicationScheduleRepository implements MedicationScheduleRepository {
  private readonly schedulesByUserId = new Map<string, MedicationSchedule[]>();
  private readonly now: () => Date;
  private nextGeneratedId = 0;

  constructor({ now = () => new Date() }: MockMedicationScheduleRepositoryOptions = {}) {
    this.now = now;
  }

  private getUserSchedules(userId: string): MedicationSchedule[] {
    const safeUserId = assertUserId(userId);
    const existing = this.schedulesByUserId.get(safeUserId);

    if (existing) {
      return existing;
    }

    const schedules: MedicationSchedule[] = [];
    this.schedulesByUserId.set(safeUserId, schedules);
    return schedules;
  }

  async listMedicationSchedules(
    userId: string,
    { medicationId, active }: MedicationScheduleListOptions = {},
  ): Promise<MedicationSchedule[]> {
    return this.getUserSchedules(userId)
      .filter((schedule) => medicationId === undefined || schedule.medicationId === medicationId)
      .filter((schedule) => active === undefined || schedule.active === active)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map(cloneSchedule);
  }

  async getMedicationScheduleById(userId: string, scheduleId: string): Promise<MedicationSchedule | null> {
    const safeScheduleId = assertScheduleId(scheduleId);
    const schedule = this.getUserSchedules(userId).find((item) => item.id === safeScheduleId);
    return schedule ? cloneSchedule(schedule) : null;
  }

  async createMedicationSchedule(
    userId: string,
    input: MedicationScheduleCreateInput,
  ): Promise<MedicationSchedule> {
    const normalized = assertValidMedicationScheduleCreateInput(input);
    const schedules = this.getUserSchedules(userId);
    const timestamp = this.now().toISOString();
    this.nextGeneratedId += 1;
    const schedule: MedicationSchedule = {
      id: `schedule-demo-${this.nextGeneratedId}`,
      medicationId: normalized.medicationId,
      recurrence: normalized.recurrence,
      localTime: normalized.localTime,
      weekdays: [...normalized.weekdays],
      startDate: normalized.startDate,
      endDate: normalized.endDate,
      timeZone: 'Asia/Ho_Chi_Minh',
      active: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    schedules.unshift(schedule);
    return cloneSchedule(schedule);
  }

  async updateMedicationSchedule(
    userId: string,
    scheduleId: string,
    input: MedicationScheduleUpdateInput,
  ): Promise<MedicationSchedule> {
    const safeScheduleId = assertScheduleId(scheduleId);
    const normalized = assertValidMedicationScheduleUpdateInput(input);
    const schedules = this.getUserSchedules(userId);
    const index = schedules.findIndex((item) => item.id === safeScheduleId);

    if (index < 0) {
      throw new Error('Không tìm thấy lịch uống thuốc cần chỉnh sửa.');
    }

    const updated: MedicationSchedule = {
      ...schedules[index],
      ...normalized,
      weekdays: [...normalized.weekdays],
      updatedAt: this.now().toISOString(),
    };
    schedules[index] = updated;
    return cloneSchedule(updated);
  }

  async pauseMedicationSchedule(userId: string, scheduleId: string): Promise<MedicationSchedule> {
    const safeScheduleId = assertScheduleId(scheduleId);
    const schedules = this.getUserSchedules(userId);
    const index = schedules.findIndex((item) => item.id === safeScheduleId);

    if (index < 0) {
      throw new Error('Không tìm thấy lịch uống thuốc cần tạm dừng.');
    }

    const current = schedules[index];
    const updated: MedicationSchedule = {
      ...current,
      active: false,
      updatedAt: current.active ? this.now().toISOString() : current.updatedAt,
    };
    schedules[index] = updated;
    return cloneSchedule(updated);
  }
}

export const mockMedicationScheduleRepository = new MockMedicationScheduleRepository();

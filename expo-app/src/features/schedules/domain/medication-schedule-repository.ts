import type {
  MedicationSchedule,
  MedicationScheduleRecurrence,
  MedicationScheduleWeekday,
} from '@/types/domain';

export const allMedicationScheduleWeekdays: readonly MedicationScheduleWeekday[] = [1, 2, 3, 4, 5, 6, 7];

export type MedicationScheduleDraft = Readonly<{
  recurrence: MedicationScheduleRecurrence;
  localTime: string;
  weekdays: readonly MedicationScheduleWeekday[];
  startDate: string;
  endDate: string | null;
}>;

export type MedicationScheduleCreateInput = MedicationScheduleDraft & Readonly<{
  medicationId: string;
}>;

export type MedicationScheduleUpdateInput = MedicationScheduleDraft;

export type MedicationScheduleListOptions = Readonly<{
  medicationId?: string;
  active?: boolean;
}>;

export interface MedicationScheduleRepository {
  listMedicationSchedules(
    userId: string,
    options?: MedicationScheduleListOptions,
  ): Promise<MedicationSchedule[]>;
  getMedicationScheduleById(userId: string, scheduleId: string): Promise<MedicationSchedule | null>;
  createMedicationSchedule(userId: string, input: MedicationScheduleCreateInput): Promise<MedicationSchedule>;
  updateMedicationSchedule(
    userId: string,
    scheduleId: string,
    input: MedicationScheduleUpdateInput,
  ): Promise<MedicationSchedule>;
  pauseMedicationSchedule(userId: string, scheduleId: string): Promise<MedicationSchedule>;
}

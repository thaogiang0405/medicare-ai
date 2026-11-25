import { MockMedicationScheduleRepository } from './mock-medication-schedule-repository';
import type { MedicationScheduleCreateInput } from '../domain/medication-schedule-repository';

const scheduleInput: MedicationScheduleCreateInput = {
  medicationId: 'medication-a',
  recurrence: 'daily' as const,
  localTime: '08:00',
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  startDate: '2026-11-19',
  endDate: null,
};

describe('MockMedicationScheduleRepository', () => {
  it('partitions schedules by signed-in UID and never seeds data', async () => {
    const repository = new MockMedicationScheduleRepository({ now: () => new Date('2026-11-19T00:00:00.000Z') });

    await expect(repository.listMedicationSchedules('user-a')).resolves.toEqual([]);
    await repository.createMedicationSchedule('user-a', scheduleInput);

    await expect(repository.listMedicationSchedules('user-a')).resolves.toHaveLength(1);
    await expect(repository.listMedicationSchedules('user-b')).resolves.toEqual([]);
  });

  it('updates and pauses only the owner-local schedule without hard deleting it', async () => {
    let now = new Date('2026-11-19T00:00:00.000Z');
    const repository = new MockMedicationScheduleRepository({ now: () => now });
    const created = await repository.createMedicationSchedule('user-a', scheduleInput);
    now = new Date('2026-11-19T01:00:00.000Z');

    const updated = await repository.updateMedicationSchedule('user-a', created.id, {
      recurrence: 'weekly',
      localTime: '20:00',
      weekdays: [1, 3, 5],
      startDate: '2026-11-19',
      endDate: '2026-12-31',
    });
    const paused = await repository.pauseMedicationSchedule('user-a', created.id);

    expect(updated).toMatchObject({ medicationId: 'medication-a', recurrence: 'weekly', weekdays: [1, 3, 5] });
    expect(paused.active).toBe(false);
    await expect(repository.listMedicationSchedules('user-a', { active: false })).resolves.toEqual([
      expect.objectContaining({ id: created.id, active: false }),
    ]);
  });

  it('returns copies so callers cannot mutate in-memory records', async () => {
    const repository = new MockMedicationScheduleRepository();
    const created = await repository.createMedicationSchedule('user-a', scheduleInput);
    created.weekdays.pop();

    await expect(repository.getMedicationScheduleById('user-a', created.id)).resolves.toMatchObject({
      weekdays: [1, 2, 3, 4, 5, 6, 7],
    });
  });
});

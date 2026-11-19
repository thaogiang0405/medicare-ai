import type { Medication, MedicationSchedule } from '@/types/domain';

import {
  getHcmScheduledAt,
  getUpcomingLocalReminderOccurrences,
  LocalReminderService,
  localReminderRollingHorizonDays,
  localReminderStorageMetadataKey,
  type LocalReminderNotificationPort,
  type LocalReminderPermission,
  type LocalReminderStoragePort,
} from './local-reminder-service';

const userA = 'elderly-a';
const userB = 'elderly-b';
const hcmSundayBeforeSchedules = new Date('2026-11-21T17:00:00.000Z');

function medication(id = 'medication-a', status: Medication['status'] = 'active'): Medication {
  return {
    id,
    name: 'Paracetamol',
    strengthText: '500 mg',
    directionsText: 'Theo hướng dẫn của bác sĩ',
    status,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  };
}

function schedule(overrides: Partial<MedicationSchedule> = {}): MedicationSchedule {
  return {
    id: 'schedule-a',
    medicationId: 'medication-a',
    recurrence: 'daily',
    localTime: '08:00',
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    startDate: '2026-11-01',
    endDate: null,
    timeZone: 'Asia/Ho_Chi_Minh',
    active: true,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

class MemoryStorage implements LocalReminderStoragePort {
  readonly values = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

function createNotificationPort(permission: LocalReminderPermission = 'granted'): LocalReminderNotificationPort & {
  readonly getPermissionMock: jest.Mock;
  readonly requestPermissionMock: jest.Mock;
  readonly scheduleNotificationMock: jest.Mock;
  readonly cancelScheduledNotificationMock: jest.Mock;
  readonly scheduledIds: Set<string>;
} {
  const scheduledIds = new Set<string>();
  let nextId = 0;
  const getPermissionMock = jest.fn(async () => permission);
  const requestPermissionMock = jest.fn(async () => permission);
  const scheduleNotificationMock = jest.fn(async () => {
    nextId += 1;
    const id = `owned-${nextId}`;
    scheduledIds.add(id);
    return id;
  });
  const cancelScheduledNotificationMock = jest.fn(async (notificationId: string) => {
    scheduledIds.delete(notificationId);
  });

  return {
    getPermission: getPermissionMock,
    requestPermission: requestPermissionMock,
    getScheduledNotificationIds: async () => [...scheduledIds],
    scheduleNotification: scheduleNotificationMock,
    cancelScheduledNotification: cancelScheduledNotificationMock,
    getPermissionMock,
    requestPermissionMock,
    scheduleNotificationMock,
    cancelScheduledNotificationMock,
    scheduledIds,
  };
}

describe('local reminder occurrence planning', () => {
  it('uses Asia/Ho_Chi_Minh local dates, weekly Monday/Sunday, inclusive range bounds, and no UTC date shift', () => {
    const occurrences = getUpcomingLocalReminderOccurrences({
      userId: userA,
      now: hcmSundayBeforeSchedules,
      medications: [medication()],
      schedules: [
        schedule({ id: 'daily-sunday', endDate: '2026-11-22' }),
        schedule({ id: 'weekly-sunday', recurrence: 'weekly', weekdays: [7], localTime: '09:00' }),
        schedule({ id: 'weekly-monday', recurrence: 'weekly', weekdays: [1], localTime: '10:00' }),
      ],
    });

    expect(occurrences).toEqual(expect.arrayContaining([
      expect.objectContaining({ scheduleId: 'daily-sunday', scheduledLocalDate: '2026-11-22', scheduledLocalTime: '08:00' }),
      expect.objectContaining({ scheduleId: 'weekly-sunday', scheduledLocalDate: '2026-11-22', scheduledLocalTime: '09:00' }),
      expect.objectContaining({ scheduleId: 'weekly-monday', scheduledLocalDate: '2026-11-23', scheduledLocalTime: '10:00' }),
    ]));
    expect(occurrences).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ scheduleId: 'daily-sunday', scheduledLocalDate: '2026-11-23' }),
    ]));
    expect(getHcmScheduledAt('2026-11-23', '00:15').toISOString()).toBe('2026-11-22T17:15:00.000Z');
  });

  it('filters paused schedules and inactive medication, bounds work to 14 days, and de-duplicates the logical key', () => {
    const occurrences = getUpcomingLocalReminderOccurrences({
      userId: userA,
      now: new Date('2026-11-22T00:00:00.000Z'),
      medications: [medication(), medication('inactive-medication', 'inactive')],
      schedules: [
        schedule(),
        schedule(),
        schedule({ id: 'paused', active: false }),
        schedule({ id: 'inactive-medication-schedule', medicationId: 'inactive-medication' }),
      ],
    });

    expect(occurrences).toHaveLength(localReminderRollingHorizonDays);
    expect(new Set(occurrences.map((occurrence) => occurrence.occurrenceKey)).size).toBe(occurrences.length);
    expect(occurrences.every((occurrence) => occurrence.scheduleId === 'schedule-a')).toBe(true);
  });
});

describe('LocalReminderService', () => {
  const syncInput = {
    userId: userA,
    now: new Date('2026-11-22T00:00:00.000Z'),
    medications: [medication()],
    schedules: [schedule({ endDate: '2026-11-22' })],
  };

  it('does not prompt or schedule before a user explicitly consents', async () => {
    const notifications = createNotificationPort('undetermined');
    const service = new LocalReminderService(notifications, new MemoryStorage());

    await expect(service.syncIfConsented(syncInput)).resolves.toEqual({
      status: 'needs-consent',
      scheduledCount: 0,
      cancelledCount: 0,
    });
    expect(notifications.requestPermissionMock).not.toHaveBeenCalled();
    expect(notifications.scheduleNotificationMock).not.toHaveBeenCalled();
  });

  it('does not save or schedule a reminder if permission is declined', async () => {
    const notifications = createNotificationPort('denied');
    const storage = new MemoryStorage();
    const service = new LocalReminderService(notifications, storage);

    await expect(service.requestPermissionAndSync(syncInput)).resolves.toEqual({
      status: 'permission-denied',
      scheduledCount: 0,
      cancelledCount: 0,
    });
    expect(notifications.requestPermissionMock).toHaveBeenCalledTimes(1);
    expect(notifications.scheduleNotificationMock).not.toHaveBeenCalled();
    expect(await storage.getItem(localReminderStorageMetadataKey)).toBeNull();
  });

  it('schedules generic one-shot reminders once, then reuses owned mappings without duplicates', async () => {
    const notifications = createNotificationPort();
    const storage = new MemoryStorage();
    const service = new LocalReminderService(notifications, storage);

    const first = await service.requestPermissionAndSync(syncInput);
    expect(first).toMatchObject({ status: 'synced', scheduledCount: 1, cancelledCount: 0 });
    expect(notifications.scheduleNotificationMock).toHaveBeenCalledTimes(1);
    expect(notifications.scheduleNotificationMock.mock.calls[0][0]).toMatchObject({
      content: {
        title: 'MediCare AI',
        body: 'Bạn có một lời nhắc cần xem.',
      },
    });
    expect(JSON.stringify(notifications.scheduleNotificationMock.mock.calls[0][0])).not.toContain('Paracetamol');

    const second = await service.syncIfConsented(syncInput);
    expect(second).toMatchObject({ status: 'synced', scheduledCount: 0, cancelledCount: 0 });
    expect(notifications.scheduleNotificationMock).toHaveBeenCalledTimes(1);
  });

  it('cancels only MediCare-owned reminder ids when a plan is removed or an account signs out', async () => {
    const notifications = createNotificationPort();
    const storage = new MemoryStorage();
    storage.values.set(localReminderStorageMetadataKey, JSON.stringify({
      version: 1,
      consentedUserIds: [userA, userB],
      reminders: [
        { ownerUid: userA, scheduleId: 'schedule-a', occurrenceKey: 'mcare-reminder:a', notificationId: 'owned-a' },
        { ownerUid: userB, scheduleId: 'schedule-b', occurrenceKey: 'mcare-reminder:b', notificationId: 'owned-b' },
      ],
    }));
    notifications.scheduledIds.add('owned-a');
    notifications.scheduledIds.add('owned-b');
    notifications.scheduledIds.add('other-app-id');
    const service = new LocalReminderService(notifications, storage);

    await expect(service.cancelUserReminders(userA)).resolves.toBe(1);
    expect(notifications.cancelScheduledNotificationMock).toHaveBeenCalledWith('owned-a');
    expect(notifications.cancelScheduledNotificationMock).not.toHaveBeenCalledWith('owned-b');
    expect(notifications.cancelScheduledNotificationMock).not.toHaveBeenCalledWith('other-app-id');
    expect(notifications.scheduledIds.has('other-app-id')).toBe(true);

    expect(JSON.parse((await storage.getItem(localReminderStorageMetadataKey)) ?? '{}').reminders).toEqual([
      expect.objectContaining({ ownerUid: userB, notificationId: 'owned-b' }),
    ]);
  });

  it('resynchronizes by cancelling owned reminders when a schedule pauses or its medication becomes inactive', async () => {
    const notifications = createNotificationPort();
    const storage = new MemoryStorage();
    const service = new LocalReminderService(notifications, storage);

    await service.requestPermissionAndSync(syncInput);
    expect(notifications.scheduledIds).toEqual(new Set(['owned-1']));

    await expect(service.syncIfConsented({
      ...syncInput,
      schedules: [schedule({ active: false, endDate: '2026-11-22' })],
    })).resolves.toMatchObject({ status: 'synced', scheduledCount: 0, cancelledCount: 1 });
    expect(notifications.cancelScheduledNotificationMock).toHaveBeenLastCalledWith('owned-1');
    expect(notifications.scheduledIds).toEqual(new Set());

    await service.syncIfConsented({ ...syncInput, schedules: [schedule({ endDate: '2026-11-22' })] });
    expect(notifications.scheduledIds).toEqual(new Set(['owned-2']));

    await expect(service.syncIfConsented({
      ...syncInput,
      medications: [medication('medication-a', 'inactive')],
    })).resolves.toMatchObject({ status: 'synced', scheduledCount: 0, cancelledCount: 1 });
    expect(notifications.cancelScheduledNotificationMock).toHaveBeenLastCalledWith('owned-2');
    expect(notifications.scheduledIds).toEqual(new Set());
  });

  it('cancels a just-scheduled owned reminder when a newer operation makes the sync stale', async () => {
    const notifications = createNotificationPort();
    const storage = new MemoryStorage();
    const service = new LocalReminderService(notifications, storage);
    let resolveScheduleStarted!: () => void;
    let resolveNotificationId!: (notificationId: string) => void;
    const scheduleStarted = new Promise<void>((resolve) => {
      resolveScheduleStarted = resolve;
    });
    const delayedNotification = new Promise<string>((resolve) => {
      resolveNotificationId = resolve;
    });

    notifications.scheduleNotificationMock.mockImplementationOnce(async () => {
      resolveScheduleStarted();
      const notificationId = await delayedNotification;
      notifications.scheduledIds.add(notificationId);
      return notificationId;
    });

    const firstSync = service.requestPermissionAndSync(syncInput);
    await scheduleStarted;

    await service.cancelUserReminders(userA);
    resolveNotificationId('owned-stale');

    await expect(firstSync).resolves.toEqual({
      status: 'stale',
      scheduledCount: 0,
      cancelledCount: 0,
    });
    expect(notifications.cancelScheduledNotificationMock).toHaveBeenCalledWith('owned-stale');
    expect(notifications.scheduledIds).toEqual(new Set());
    expect(JSON.parse((await storage.getItem(localReminderStorageMetadataKey)) ?? '{}').reminders).toEqual([]);
  });
});

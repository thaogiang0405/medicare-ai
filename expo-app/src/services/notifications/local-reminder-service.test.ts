import type { Medication, MedicationSchedule } from '@/types/domain';

import {
  getHcmScheduledAt,
  getUpcomingLocalReminderOccurrences,
  LocalReminderService,
  localReminderMaxPendingNotifications,
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

class DelayedWriteStorage extends MemoryStorage {
  private nextWriteGate: {
    notifyStarted: () => void;
    waitForRelease: Promise<void>;
  } | null = null;

  delayNextWrite(): { writeStarted: Promise<void>; release: () => void } {
    let notifyStarted!: () => void;
    let release!: () => void;
    const writeStarted = new Promise<void>((resolve) => {
      notifyStarted = resolve;
    });
    const waitForRelease = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.nextWriteGate = { notifyStarted, waitForRelease };

    return { writeStarted, release };
  }

  override async setItem(key: string, value: string): Promise<void> {
    const gate = this.nextWriteGate;
    this.nextWriteGate = null;

    if (gate) {
      gate.notifyStarted();
      await gate.waitForRelease;
    }

    await super.setItem(key, value);
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

    await expect(service.syncIfConsented(syncInput)).resolves.toMatchObject({
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

    await expect(service.requestPermissionAndSync(syncInput)).resolves.toMatchObject({
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

    const restartedService = new LocalReminderService(notifications, storage);
    const second = await restartedService.syncIfConsented(syncInput);
    expect(second).toMatchObject({ status: 'synced', scheduledCount: 0, cancelledCount: 0 });
    expect(notifications.scheduleNotificationMock).toHaveBeenCalledTimes(1);
  });

  it('requests iOS permission only after the explicit enable action, then schedules after a grant', async () => {
    const notifications = createNotificationPort('undetermined');
    notifications.requestPermissionMock.mockResolvedValue('granted');
    const service = new LocalReminderService(notifications, new MemoryStorage());

    await expect(service.requestPermissionAndSync(syncInput)).resolves.toMatchObject({
      status: 'synced',
      scheduledCount: 1,
      pendingCount: 1,
    });
    expect(notifications.requestPermissionMock).toHaveBeenCalledTimes(1);
    expect(notifications.scheduleNotificationMock).toHaveBeenCalledTimes(1);
  });

  it('does not let a passive refresh interrupt an explicit permission request', async () => {
    const notifications = createNotificationPort('undetermined');
    let resolvePermission!: (permission: LocalReminderPermission) => void;
    const permissionRequest = new Promise<LocalReminderPermission>((resolve) => {
      resolvePermission = resolve;
    });
    notifications.requestPermissionMock.mockImplementationOnce(async () => permissionRequest);
    const service = new LocalReminderService(notifications, new MemoryStorage());

    const explicitEnable = service.requestPermissionAndSync(syncInput);
    await Promise.resolve();

    await expect(service.syncIfConsented(syncInput)).resolves.toMatchObject({ status: 'stale' });
    resolvePermission('granted');
    await expect(explicitEnable).resolves.toMatchObject({ status: 'synced', scheduledCount: 1 });
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

  it('keeps a conservative device-wide budget, prioritizes earliest occurrences, and reserves room for other pending ids', async () => {
    const notifications = createNotificationPort();
    const storage = new MemoryStorage();
    storage.values.set(localReminderStorageMetadataKey, JSON.stringify({
      version: 1,
      consentedUserIds: [userA, userB],
      reminders: [
        { ownerUid: userB, scheduleId: 'other-schedule', occurrenceKey: 'mcare-reminder:other', notificationId: 'other-owned' },
      ],
    }));
    notifications.scheduledIds.add('other-owned');
    notifications.scheduledIds.add('unmanaged-one');
    notifications.scheduledIds.add('unmanaged-two');
    const service = new LocalReminderService(notifications, storage);
    const denseSchedules = ['06:00', '08:00', '10:00', '12:00'].map((localTime, index) =>
      schedule({ id: `dense-${index}`, localTime }));

    const result = await service.requestPermissionAndSync({
      userId: userA,
      now: new Date('2026-11-21T17:01:00.000Z'),
      medications: [medication()],
      schedules: denseSchedules,
    });

    expect(result).toMatchObject({
      status: 'capacity-limited',
      desiredCount: 56,
      scheduledCount: localReminderMaxPendingNotifications - 3,
      pendingCount: localReminderMaxPendingNotifications - 3,
      omittedCount: 11,
    });
    expect(notifications.scheduledIds.size).toBe(localReminderMaxPendingNotifications);
    expect(notifications.scheduledIds.has('other-owned')).toBe(true);
    expect(notifications.scheduledIds.has('unmanaged-one')).toBe(true);
    expect(notifications.scheduledIds.has('unmanaged-two')).toBe(true);
    const triggerTimes = notifications.scheduleNotificationMock.mock.calls
      .map(([request]) => (request as { triggerAt: Date }).triggerAt.getTime());
    expect(triggerTimes).toEqual([...triggerTimes].sort((left, right) => left - right));
  });

  it('revokes one account consent only after an explicit disable and never cancels another account', async () => {
    const notifications = createNotificationPort();
    const storage = new MemoryStorage();
    const service = new LocalReminderService(notifications, storage);

    await service.requestPermissionAndSync(syncInput);
    await service.requestPermissionAndSync({ ...syncInput, userId: userB });
    const disable = await service.disableUserReminders(userA);

    expect(disable).toEqual({ status: 'disabled', cancelledCount: 1 });
    expect(notifications.cancelScheduledNotificationMock).toHaveBeenCalledWith('owned-1');
    expect(notifications.cancelScheduledNotificationMock).not.toHaveBeenCalledWith('owned-2');
    await expect(service.getUserReminderSettings(userA)).resolves.toMatchObject({
      consented: false,
      pendingCount: 0,
      maxPendingCount: localReminderMaxPendingNotifications,
    });
    await expect(service.getUserReminderSettings(userB)).resolves.toMatchObject({
      consented: true,
      pendingCount: 1,
    });
    await expect(service.syncIfConsented(syncInput)).resolves.toMatchObject({ status: 'needs-consent' });
  });

  it('records prior consent even when there are no eligible schedules, without scheduling a notification', async () => {
    const notifications = createNotificationPort();
    const service = new LocalReminderService(notifications, new MemoryStorage());

    await expect(service.requestPermissionAndSync({
      ...syncInput,
      schedules: [schedule({ active: false })],
    })).resolves.toMatchObject({
      status: 'synced',
      desiredCount: 0,
      pendingCount: 0,
      scheduledCount: 0,
    });
    expect(notifications.scheduleNotificationMock).not.toHaveBeenCalled();
    await expect(service.getUserReminderSettings(userA)).resolves.toMatchObject({ consented: true, pendingCount: 0 });
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

    const logout = service.cancelUserReminders(userA);
    resolveNotificationId('owned-stale');

    await expect(firstSync).resolves.toMatchObject({
      status: 'stale',
      scheduledCount: 0,
      cancelledCount: 0,
    });
    await expect(logout).resolves.toBe(0);
    expect(notifications.cancelScheduledNotificationMock).toHaveBeenCalledWith('owned-stale');
    expect(notifications.scheduledIds).toEqual(new Set());
    expect(JSON.parse((await storage.getItem(localReminderStorageMetadataKey)) ?? '{}').reminders).toEqual([]);
  });

  it('removes reminder metadata written immediately before a logout invalidates the sync', async () => {
    const notifications = createNotificationPort();
    const storage = new DelayedWriteStorage();
    const service = new LocalReminderService(notifications, storage);
    const delayedWrite = storage.delayNextWrite();

    const sync = service.requestPermissionAndSync(syncInput);
    await delayedWrite.writeStarted;
    const logout = service.cancelUserReminders(userA);
    delayedWrite.release();

    await expect(sync).resolves.toMatchObject({ status: 'stale', scheduledCount: 0 });
    await expect(logout).resolves.toBe(0);
    expect(notifications.cancelScheduledNotificationMock).toHaveBeenCalledWith('owned-1');
    expect(notifications.scheduledIds).toEqual(new Set());
    expect(JSON.parse((await storage.getItem(localReminderStorageMetadataKey)) ?? '{}').reminders).toEqual([]);
  });
});

/* eslint-disable import/first */

// Firestore listeners are tested with simulated snapshots, not Firebase Auth
// initialization. This suite must not connect to a real Firebase project.
jest.mock('@/services/firebase', () => ({
  getFirebaseAuth: jest.fn(),
  getFirebaseFirestore: jest.fn(),
}));
jest.mock('firebase/firestore', () => ({
  onSnapshot: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  limit: jest.fn(),
  getDocsFromServer: jest.fn(),
  runTransaction: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(),
}));

import {
  collection, doc, getDocsFromServer, limit, onSnapshot, query, runTransaction, serverTimestamp, setDoc, where,
} from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseFirestore } from '@/services/firebase';
import {
  approveCaregiverLink,
  listOwnCaregiverLinks,
  revokeCaregiverLink,
  watchCaregiverPlans,
  type CaregiverScheduleResult,
} from './family-link-repository';

type Snapshot = {
  metadata: { fromCache: boolean };
  exists?: () => boolean;
  data?: () => Record<string, unknown>;
  size?: number;
  docs?: { id: string; data: () => Record<string, unknown> }[];
};
type Listener = (snapshot: Snapshot) => void;

const elderlyUid = 'elderly-123';
const caregiverUid = 'caregiver-123';
const linkPath = 'elderlyProfiles/' + elderlyUid + '/caregiverLinks/' + caregiverUid;
const medicationsPath = 'elderlyProfiles/' + elderlyUid + '/medications';
const schedulesPath = 'elderlyProfiles/' + elderlyUid + '/medicationSchedules';

let authUid: string | null = caregiverUid;
let observed: Map<string, Listener>;
let stops: Map<string, jest.Mock>;
let errors: Map<string, () => void>;
let received: CaregiverScheduleResult[];

function emit(path: string, snapshot: Snapshot) {
  const listener = observed.get(path);
  if (!listener) throw new Error('Listener missing: ' + path);
  listener(snapshot);
}

function linkSnapshot(active: boolean, fromCache = false): Snapshot {
  return {
    metadata: { fromCache },
    exists: () => active,
    data: () => ({
      ownerUid: elderlyUid,
      caregiverUid,
      status: active ? 'active' : 'revoked',
    }),
  };
}

function recordsSnapshot(
  records: { id: string; fields: Record<string, unknown> }[],
  fromCache = false,
): Snapshot {
  return {
    metadata: { fromCache },
    size: records.length,
    docs: records.map(({ id, fields }) => ({ id, data: () => fields })),
  };
}

const fakeTimestamp = () => ({
  seconds: 1_700_000_000,
  nanoseconds: 0,
  toDate: () => new Date('2023-11-14T22:13:20.000Z'),
});
const medicationData = (overrides: Record<string, unknown> = {}) => ({
  ownerUid: elderlyUid,
  name: 'Thuốc từ Firestore',
  strengthText: '500 mg',
  directionsText: 'Theo chỉ định',
  status: 'active',
  createdAt: fakeTimestamp(),
  updatedAt: fakeTimestamp(),
  revision: 1,
  ...overrides,
});
const scheduleData = (overrides: Record<string, unknown> = {}) => ({
  ownerUid: elderlyUid,
  medicationId: 'medicine-1',
  localTime: '08:00',
  recurrence: 'daily',
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  startDate: '2026-01-01',
  endDate: null,
  timeZone: 'Asia/Ho_Chi_Minh',
  active: true,
  revision: 1,
  createdAt: fakeTimestamp(),
  updatedAt: fakeTimestamp(),
  ...overrides,
});
const med = recordsSnapshot([
  { id: 'medicine-1', fields: medicationData() },
]);
const schedule = recordsSnapshot([
  { id: 'schedule-1', fields: scheduleData() },
]);

describe('Family Care Firestore watcher fail-closed behavior', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authUid = caregiverUid;
    observed = new Map();
    stops = new Map();
    errors = new Map();
    received = [];

    (getFirebaseAuth as unknown as jest.Mock).mockImplementation(() => ({
      currentUser: authUid ? { uid: authUid } : null,
    }));
    (getFirebaseFirestore as unknown as jest.Mock).mockReturnValue({});
    (doc as unknown as jest.Mock).mockImplementation((_db: unknown, ...segments: string[]) => ({
      path: segments.join('/'),
    }));
    (collection as unknown as jest.Mock).mockImplementation((_db: unknown, ...segments: string[]) => ({
      path: segments.join('/'),
    }));
    (query as unknown as jest.Mock).mockImplementation((reference: { path: string }) => reference);
    (limit as unknown as jest.Mock).mockImplementation((number: number) => number);
    (where as unknown as jest.Mock).mockImplementation((...args: unknown[]) => args);
    (onSnapshot as unknown as jest.Mock).mockImplementation((
      reference: { path: string },
      _options: unknown,
      next: Listener,
      onError: () => void,
    ) => {
      const unsubscribe = jest.fn();
      observed.set(reference.path, next);
      errors.set(reference.path, onError);
      stops.set(reference.path, unsubscribe);
      return unsubscribe;
    });
  });

  it('blocks caregiver approval when an active medication has unexpected fields', async () => {
    authUid = elderlyUid;
    (getDocsFromServer as unknown as jest.Mock)
      .mockResolvedValueOnce({
        size: 1,
        docs: [{ id: 'medicine-1', data: () => medicationData({ internalNote: 'not approved for sharing' }) }],
      })
      .mockResolvedValueOnce({ size: 0, docs: [] });

    await expect(approveCaregiverLink(elderlyUid, caregiverUid))
      .rejects.toThrow('cấu trúc chia sẻ an toàn');
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('blocks caregiver approval when an active schedule has unexpected fields', async () => {
    authUid = elderlyUid;
    (getDocsFromServer as unknown as jest.Mock)
      .mockResolvedValueOnce({ size: 0, docs: [] })
      .mockResolvedValueOnce({
        size: 1,
        docs: [{ id: 'schedule-1', data: () => scheduleData({ privateNote: 'not approved for sharing' }) }],
      });

    await expect(approveCaregiverLink(elderlyUid, caregiverUid))
      .rejects.toThrow('cấu trúc chia sẻ an toàn');
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('checks all active owner records from the server before creating a caregiver link', async () => {
    authUid = elderlyUid;
    (getDocsFromServer as unknown as jest.Mock)
      .mockResolvedValueOnce({
        size: 1,
        docs: [{ id: 'medicine-1', data: () => medicationData() }],
      })
      .mockResolvedValueOnce({
        size: 1,
        docs: [{ id: 'schedule-1', data: () => scheduleData() }],
      });

    await expect(approveCaregiverLink(elderlyUid, caregiverUid)).resolves.toBeUndefined();
    expect(getDocsFromServer).toHaveBeenCalledTimes(2);
    expect(setDoc).toHaveBeenCalledWith(
      { path: linkPath },
      expect.objectContaining({
        ownerUid: elderlyUid,
        caregiverUid,
        status: 'active',
        revision: 1,
      }),
    );
  });

  it('loads the elderly owner link list from server, not offline cached grants', async () => {
    authUid = elderlyUid;
    (getDocsFromServer as unknown as jest.Mock).mockResolvedValue({
      docs: [{ id: caregiverUid, data: () => ({
        ownerUid: elderlyUid, caregiverUid, status: 'active', revision: 1,
      }) }],
    });
    await expect(listOwnCaregiverLinks(elderlyUid)).resolves.toEqual([
      { caregiverUid, status: 'active', revision: 1 },
    ]);
    expect(getDocsFromServer).toHaveBeenCalledTimes(1);

    (getDocsFromServer as unknown as jest.Mock).mockRejectedValueOnce(new Error('network unavailable'));
    await expect(listOwnCaregiverLinks(elderlyUid)).rejects.toThrow('network unavailable');
  });

  it('revokes with a server transaction using the latest revision and is idempotent', async () => {
    authUid = elderlyUid;
    const update = jest.fn();
    const get = jest.fn().mockResolvedValue({
      exists: () => true,
      data: () => ({
        ownerUid: elderlyUid, caregiverUid, status: 'active', revision: 3,
      }),
    });
    (serverTimestamp as unknown as jest.Mock).mockReturnValue('server-clock');
    (runTransaction as unknown as jest.Mock).mockImplementation(
      (_database: unknown, callback: (transaction: { get: typeof get; update: typeof update }) => Promise<void>) =>
        callback({ get, update }),
    );
    await expect(revokeCaregiverLink(elderlyUid, caregiverUid)).resolves.toBeUndefined();
    expect(update).toHaveBeenCalledWith(
      { path: linkPath },
      { status: 'revoked', revision: 4, updatedAt: 'server-clock' },
    );

    get.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        ownerUid: elderlyUid, caregiverUid, status: 'revoked', revision: 4,
      }),
    });
    update.mockClear();
    await expect(revokeCaregiverLink(elderlyUid, caregiverUid)).resolves.toBeUndefined();
    expect(update).not.toHaveBeenCalled();
  });

  it('does not queue permission revocation when Firestore cannot reach the server', async () => {
    authUid = elderlyUid;
    (runTransaction as unknown as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await expect(revokeCaregiverLink(elderlyUid, caregiverUid)).rejects.toThrow('offline');
  });

  it('stops revocation if the Firebase Auth account changes during the transaction', async () => {
    authUid = elderlyUid;
    const update = jest.fn();
    (runTransaction as unknown as jest.Mock).mockImplementation(
      async (_database: unknown, callback: (transaction: {
        get: () => Promise<unknown>;
        update: typeof update;
      }) => Promise<void>) => callback({
        get: async () => {
          authUid = caregiverUid;
          return { exists: () => true, data: () => ({
            ownerUid: elderlyUid, caregiverUid, status: 'active', revision: 1,
          }) };
        },
        update,
      }),
    );
    await expect(revokeCaregiverLink(elderlyUid, caregiverUid)).rejects.toThrow('Phiên đăng nhập đã thay đổi');
    expect(update).not.toHaveBeenCalled();
  });

  it('does not observe medication or schedule documents until the approved link arrives from server', () => {
    const close = watchCaregiverPlans(caregiverUid, elderlyUid, (state) => received.push(state));
    expect(received).toEqual([{ status: 'loading', plans: [] }]);
    expect(observed.has(linkPath)).toBe(true);
    expect(observed.has(medicationsPath)).toBe(false);
    expect(observed.has(schedulesPath)).toBe(false);

    emit(linkPath, linkSnapshot(true, true));
    expect(received[received.length - 1]).toEqual({ status: 'loading', plans: [] });
    expect(observed.has(medicationsPath)).toBe(false);
    emit(linkPath, linkSnapshot(true));
    expect(observed.has(medicationsPath)).toBe(true);
    expect(observed.has(schedulesPath)).toBe(true);
    expect(where).toHaveBeenCalledWith('ownerUid', '==', elderlyUid);
    expect(where).toHaveBeenCalledWith('status', '==', 'active');
    expect(where).toHaveBeenCalledWith('ownerUid', '==', elderlyUid);
    expect(where).toHaveBeenCalledWith('active', '==', true);
    close();
    expect(stops.get(linkPath)).toHaveBeenCalledTimes(1);
    expect(stops.get(medicationsPath)).toHaveBeenCalledTimes(1);
    expect(stops.get(schedulesPath)).toHaveBeenCalledTimes(1);
  });

  it('emits planned medicine rows only after both server-confirmed collections arrive', () => {
    const close = watchCaregiverPlans(caregiverUid, elderlyUid, (state) => received.push(state));
    emit(linkPath, linkSnapshot(true));
    emit(medicationsPath, med);
    expect(received).toEqual([{ status: 'loading', plans: [] }]);

    emit(schedulesPath, schedule);
    expect(received.at(-1)?.status).toBe('ready');
    expect(received.at(-1)?.medicationNames).toEqual(['Thuốc từ Firestore']);
    expect(received.at(-1)?.plans).toEqual([
      { time: '08:00', medicationName: 'Thuốc từ Firestore' },
    ]);

    emit(medicationsPath, recordsSnapshot([], true));
    expect(received.at(-1)).toEqual({ status: 'loading', plans: [] });
    close();
  });

  it('rejects malformed active medication data without showing a partial schedule', () => {
    const close = watchCaregiverPlans(caregiverUid, elderlyUid, (state) => received.push(state));
    emit(linkPath, linkSnapshot(true));
    emit(medicationsPath, med);
    emit(schedulesPath, schedule);
    expect(received.at(-1)?.status).toBe('ready');

    emit(medicationsPath, recordsSnapshot([
      { id: 'medicine-1', fields: medicationData() },
      { id: 'invalid', fields: medicationData({ ownerUid: 'another-owner', name: 'Unknown' }) },
    ]));
    expect(received.at(-1)).toMatchObject({ status: 'error', plans: [], message: expect.any(String) });
    expect(stops.get(medicationsPath)).toHaveBeenCalledTimes(1);
    expect(stops.get(schedulesPath)).toHaveBeenCalledTimes(1);
    close();
  });

  it('rejects invalid active schedule dates instead of quietly hiding a medicine', () => {
    const close = watchCaregiverPlans(caregiverUid, elderlyUid, (state) => received.push(state));
    emit(linkPath, linkSnapshot(true));
    emit(medicationsPath, med);
    emit(schedulesPath, schedule);
    expect(received.at(-1)?.status).toBe('ready');

    emit(schedulesPath, recordsSnapshot([
      { id: 'invalid', fields: {
        ...scheduleData({ localTime: '09:00', startDate: '2026-02-30' }),
      } },
    ]));
    expect(received.at(-1)).toMatchObject({ status: 'error', plans: [], message: expect.any(String) });
    expect(stops.get(linkPath)).toHaveBeenCalledTimes(1);
    close();
  });

  it('removes visible medicine data as soon as the owner revokes the link', () => {
    const close = watchCaregiverPlans(caregiverUid, elderlyUid, (state) => received.push(state));
    emit(linkPath, linkSnapshot(true));
    emit(medicationsPath, med);
    emit(schedulesPath, schedule);
    expect(received.at(-1)?.status).toBe('ready');

    emit(linkPath, linkSnapshot(false));
    expect(received.at(-1)?.status).toBe('revoked');
    expect(received.at(-1)?.plans).toEqual([]);
    expect(stops.get(medicationsPath)).toHaveBeenCalledTimes(1);
    expect(stops.get(schedulesPath)).toHaveBeenCalledTimes(1);
    expect(stops.get(linkPath)).toHaveBeenCalledTimes(1);
    const count = received.length;
    emit(medicationsPath, med); // delayed callback from an already stopped listener
    expect(received).toHaveLength(count);
    close();
  });

  it('fails closed without a link or when rules reject the link lookup', () => {
    const stopMissing = watchCaregiverPlans(caregiverUid, elderlyUid, (state) => received.push(state));
    emit(linkPath, linkSnapshot(false));
    expect(received.at(-1)?.plans).toEqual([]);
    expect(received.at(-1)?.status).toBe('revoked');
    expect(observed.has(medicationsPath)).toBe(false);
    stopMissing();

    received = [];
    const stopDenied = watchCaregiverPlans(caregiverUid, elderlyUid, (state) => received.push(state));
    errors.get(linkPath)?.();
    expect(received.at(-1)?.plans).toEqual([]);
    expect(received.at(-1)?.status).toBe('revoked');
    stopDenied();
  });

  it('clears health data when the signed-in caregiver changes', () => {
    const close = watchCaregiverPlans(caregiverUid, elderlyUid, (state) => received.push(state));
    emit(linkPath, linkSnapshot(true));
    emit(medicationsPath, med);
    emit(schedulesPath, schedule);
    expect(received.at(-1)?.status).toBe('ready');

    authUid = 'different-caregiver';
    emit(schedulesPath, schedule);
    expect(received.at(-1)?.status).toBe('revoked');
    expect(received.at(-1)?.plans).toEqual([]);
    close();
  });

  it('updates a weekly schedule automatically when Vietnam crosses midnight', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-23T16:59:59.900Z')); // Monday 23:59:59.900 in Vietnam
    const mondayOnly = recordsSnapshot([{
      id: 'weekly-monday',
      fields: scheduleData({ recurrence: 'weekly', weekdays: [1] }),
    }]);
    const close = watchCaregiverPlans(caregiverUid, elderlyUid, (state) => received.push(state));
    emit(linkPath, linkSnapshot(true));
    emit(medicationsPath, med);
    emit(schedulesPath, mondayOnly);
    expect(received.at(-1)?.scheduleDate).toBe('2026-11-23');
    expect(received.at(-1)?.plans).toHaveLength(1);

    jest.advanceTimersByTime(250);
    expect(received.at(-1)?.scheduleDate).toBe('2026-11-24');
    expect(received.at(-1)?.plans).toHaveLength(0);
    close();
  });


  it('ignores queued medication and schedule callbacks after link metadata becomes cache-only', () => {
    const close = watchCaregiverPlans(caregiverUid, elderlyUid, (state) => received.push(state));
    emit(linkPath, linkSnapshot(true));
    const oldMedicationListener = observed.get(medicationsPath);
    const oldScheduleListener = observed.get(schedulesPath);
    expect(oldMedicationListener).toBeTruthy();
    expect(oldScheduleListener).toBeTruthy();

    emit(linkPath, linkSnapshot(true, true));
    expect(received.at(-1)).toEqual({ status: 'loading', plans: [] });

    // Simulate callbacks already queued before unsubscribe() took effect.
    oldMedicationListener?.(med);
    oldScheduleListener?.(schedule);
    expect(received.at(-1)).toEqual({ status: 'loading', plans: [] });
    expect(received.some((state) => state.status === 'ready')).toBe(false);
    close();
  });

  it('prevents any result being delivered after screen unsubscribe', () => {
    const close = watchCaregiverPlans(caregiverUid, elderlyUid, (state) => received.push(state));
    emit(linkPath, linkSnapshot(true));
    const before = received.length;
    close();
    emit(linkPath, linkSnapshot(false));
    emit(medicationsPath, med);
    emit(schedulesPath, schedule);
    expect(received).toHaveLength(before);
  });
});

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
  limit: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  serverTimestamp: jest.fn(),
}));

import {
  collection, doc, limit, onSnapshot, query,
} from 'firebase/firestore';
import { getFirebaseAuth, getFirebaseFirestore } from '@/services/firebase';
import {
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

const med = recordsSnapshot([
  { id: 'medicine-1', fields: { ownerUid: elderlyUid, name: 'Thuốc từ Firestore', status: 'active' } },
]);
const schedule = recordsSnapshot([
  {
    id: 'schedule-1',
    fields: {
      ownerUid: elderlyUid,
      medicationId: 'medicine-1',
      localTime: '08:00',
      recurrence: 'daily',
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      startDate: '2026-01-01',
      endDate: null,
      timeZone: 'Asia/Ho_Chi_Minh',
      active: true,
    },
  },
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
      fields: {
        ownerUid: elderlyUid,
        medicationId: 'medicine-1', localTime: '08:00',
        recurrence: 'weekly', weekdays: [1],
        startDate: '2026-01-01', endDate: null,
        timeZone: 'Asia/Ho_Chi_Minh', active: true,
      },
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

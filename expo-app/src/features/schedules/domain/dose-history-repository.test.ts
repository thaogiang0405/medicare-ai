import type { DoseEvent } from '@/types/domain';

import {
  getDoseHistoryCursor,
  getDoseHistoryDateRange,
  normalizeDoseHistoryQuery,
} from './dose-history-repository';

function event(overrides: Partial<DoseEvent> = {}): DoseEvent {
  return {
    id: 'schedule-a__2026-11-22__08:00',
    ownerUid: 'elderly-a',
    scheduleId: 'schedule-a',
    medicationId: 'medication-a',
    occurrenceKey: '2026-11-22T08:00@Asia/Ho_Chi_Minh',
    scheduledAt: '2026-11-22T01:00:00.000Z',
    scheduledLocalDate: '2026-11-22',
    scheduledLocalTime: '08:00',
    timeZone: 'Asia/Ho_Chi_Minh',
    medicationSnapshot: { name: 'Paracetamol', strengthText: '500 mg', directionsText: 'Theo hướng dẫn' },
    status: 'reportedTaken',
    responseSource: 'selfReported',
    respondedAt: '2026-11-22T01:01:00.000Z',
    respondedBy: 'elderly-a',
    responseHistory: {
      initial: {
        status: 'reportedTaken',
        responseSource: 'selfReported',
        respondedAt: '2026-11-22T01:01:00.000Z',
        respondedBy: 'elderly-a',
      },
    },
    revision: 1,
    ...overrides,
  };
}

describe('dose history query domain', () => {
  it('uses the Vietnam calendar rather than the device UTC date for bounded windows', () => {
    const now = new Date('2026-11-21T17:10:00.000Z'); // 00:10 in Ho Chi Minh on 22 Nov.

    expect(getDoseHistoryDateRange('day', now)).toEqual({ startLocalDate: '2026-11-22', endLocalDate: '2026-11-22' });
    expect(getDoseHistoryDateRange('sevenDays', now)).toEqual({ startLocalDate: '2026-11-16', endLocalDate: '2026-11-22' });
    expect(getDoseHistoryDateRange('thirtyDays', now)).toEqual({ startLocalDate: '2026-10-24', endLocalDate: '2026-11-22' });
  });

  it('rejects an unbounded, malformed, or out-of-window cursor before Firebase is called', () => {
    expect(() => normalizeDoseHistoryQuery({
      startLocalDate: '2026-11-22',
      endLocalDate: '2026-11-16',
      pageSize: 20,
    })).toThrow('Khoảng ngày lịch sử không hợp lệ.');

    expect(() => normalizeDoseHistoryQuery({
      startLocalDate: '2026-11-16',
      endLocalDate: '2026-11-22',
      pageSize: 31,
    })).toThrow('Số lượng bản ghi lịch sử không hợp lệ.');

    expect(() => normalizeDoseHistoryQuery({
      startLocalDate: '2026-11-16',
      endLocalDate: '2026-11-22',
      pageSize: 20,
      cursor: { scheduledLocalDate: '2026-11-15', scheduledLocalTime: '08:00', id: 'event-a' },
    })).toThrow('Con trỏ lịch sử nằm ngoài khoảng ngày đang xem.');
  });

  it('creates an immutable pagination cursor only from a valid persisted event', () => {
    expect(getDoseHistoryCursor(event())).toEqual({
      scheduledLocalDate: '2026-11-22',
      scheduledLocalTime: '08:00',
      id: 'schedule-a__2026-11-22__08:00',
    });
    expect(() => getDoseHistoryCursor(event({ id: '../other' }))).toThrow('Con trỏ lịch sử uống thuốc không hợp lệ.');
  });
});

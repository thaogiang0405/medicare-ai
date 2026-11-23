import { deriveCaregiverPlans, validateFamilyUid } from './family-link-repository';
import { isFamilyCareFeatureEnabled } from '@/services/firebase/family-care-feature';

describe('owner-approved Family Care client guardrails', () => {
  it('never interprets a profile code as a credential and rejects unsafe path identifiers', () => {
    expect(validateFamilyUid(' caregiver-123 ')).toBe('caregiver-123');
    for (const code of ['', 'a', '../user', 'user/a', 'user b', 'x'.repeat(129), '🤖']) {
      expect(() => validateFamilyUid(code)).toThrow();
    }
  });

  it('keeps family routes behind an explicit disabled-by-default public flag', () => {
    expect(isFamilyCareFeatureEnabled(undefined)).toBe(false);
    expect(isFamilyCareFeatureEnabled('false')).toBe(false);
    expect(isFamilyCareFeatureEnabled(' true ')).toBe(true);
  });

  it('displays only currently active owner medicines and matching daily/weekly plans', () => {
    const meds = [
      { id: 'med-1', name: 'Thuốc đã nhập', status: 'active' },
      { id: 'med-2', name: 'Thuốc dừng', status: 'inactive' },
    ];
    const schedules = [
      { medicationId: 'med-1', localTime: '20:15', recurrence: 'daily', weekdays: [1,2,3,4,5,6,7], startDate: '2026-11-01', endDate: null, active: true },
      { medicationId: 'med-1', localTime: '08:00', recurrence: 'weekly', weekdays: [1], startDate: '2026-11-01', endDate: null, active: true },
      { medicationId: 'med-1', localTime: '09:00', recurrence: 'weekly', weekdays: [2], startDate: '2026-11-01', endDate: null, active: true },
      { medicationId: 'med-2', localTime: '11:00', recurrence: 'daily', weekdays: [1,2,3,4,5,6,7], startDate: '2026-11-01', endDate: null, active: true },
      { medicationId: 'med-1', localTime: '12:00', recurrence: 'daily', weekdays: [1,2,3,4,5,6,7], startDate: '2026-12-01', endDate: null, active: true },
      { medicationId: 'med-1', localTime: '13:00', recurrence: 'daily', weekdays: [1,2,3,4,5,6,7], startDate: '2026-10-01', endDate: '2026-11-22', active: true },
      { medicationId: 'med-1', localTime: '14:00', recurrence: 'daily', weekdays: [1,2,3,4,5,6,7], startDate: '2026-11-01', endDate: null, active: false },
    ];
    expect(deriveCaregiverPlans(meds, schedules, new Date('2026-11-23T03:00:00.000Z'))).toEqual([
      { time: '08:00', medicationName: 'Thuốc đã nhập' },
      { time: '20:15', medicationName: 'Thuốc đã nhập' },
    ]);
  });

  it('ignores malformed schedule rows rather than crashing or inferring a dose', () => {
    const medications = [{ id: 'm1', name: 'Tên thuốc hợp lệ', status: 'active' }];
    const entries = [
      { medicationId: 'm1', localTime: 'bad', recurrence: 'daily', weekdays: [1,2,3,4,5,6,7], startDate: '2026-11-01', endDate: null, active: true },
      { medicationId: 'm1', localTime: '08:00', recurrence: 'weekly', weekdays: [], startDate: '2026-11-01', endDate: null, active: true },
      { medicationId: 'm1', localTime: '10:00', recurrence: 'daily', weekdays: [1,2,3,4,5,6,7], startDate: '2026-11-01', endDate: null, active: true },
    ];
    expect(deriveCaregiverPlans(medications, entries, new Date('2026-11-23T03:00:00.000Z'))).toEqual([
      { time: '10:00', medicationName: 'Tên thuốc hợp lệ' },
    ]);
  });
});

import { isFirestoreSchedulesFeatureEnabled } from './firestore-schedule-feature';

describe('isFirestoreSchedulesFeatureEnabled', () => {
  it('requires explicit local opt-in', () => {
    expect(isFirestoreSchedulesFeatureEnabled(undefined)).toBe(false);
    expect(isFirestoreSchedulesFeatureEnabled('false')).toBe(false);
    expect(isFirestoreSchedulesFeatureEnabled(' true ')).toBe(true);
  });
});

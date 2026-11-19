import { isFirestoreDoseEventsFeatureEnabled } from './firestore-dose-event-feature';

describe('isFirestoreDoseEventsFeatureEnabled', () => {
  it('keeps Firestore dose tracking off unless it is explicitly opted in', () => {
    expect(isFirestoreDoseEventsFeatureEnabled(undefined)).toBe(false);
    expect(isFirestoreDoseEventsFeatureEnabled(' false ')).toBe(false);
    expect(isFirestoreDoseEventsFeatureEnabled('true')).toBe(true);
  });
});

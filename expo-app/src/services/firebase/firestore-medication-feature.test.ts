import { isFirestoreMedicationsFeatureEnabled } from './firestore-medication-feature';

describe('isFirestoreMedicationsFeatureEnabled', () => {
  it('requires an explicit true value', () => {
    expect(isFirestoreMedicationsFeatureEnabled(undefined)).toBe(false);
    expect(isFirestoreMedicationsFeatureEnabled('false')).toBe(false);
    expect(isFirestoreMedicationsFeatureEnabled(' true ')).toBe(true);
  });
});

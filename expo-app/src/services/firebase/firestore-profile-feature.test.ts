import { isFirestoreUserProfilesFeatureEnabled } from './firestore-profile-feature';

describe('isFirestoreUserProfilesFeatureEnabled', () => {
  it('requires an explicit true value', () => {
    expect(isFirestoreUserProfilesFeatureEnabled(undefined)).toBe(false);
    expect(isFirestoreUserProfilesFeatureEnabled('false')).toBe(false);
    expect(isFirestoreUserProfilesFeatureEnabled(' true ')).toBe(true);
  });
});

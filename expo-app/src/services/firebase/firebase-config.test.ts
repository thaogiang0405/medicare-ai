import { createFirebaseConfig, FirebaseConfigurationError } from './firebase-config';

describe('createFirebaseConfig', () => {
  it('fails explicitly instead of substituting a fallback Firebase project', () => {
    expect(() => createFirebaseConfig({})).toThrow(FirebaseConfigurationError);

    try {
      createFirebaseConfig({});
    } catch (error) {
      expect(error).toBeInstanceOf(FirebaseConfigurationError);
      expect((error as FirebaseConfigurationError).missingVariables).toContain(
        'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
      );
    }
  });
});

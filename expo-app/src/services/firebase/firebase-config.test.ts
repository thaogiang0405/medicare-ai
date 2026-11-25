import { createFirebaseConfig, FirebaseConfigurationError } from './firebase-config';

describe('createFirebaseConfig', () => {
  it('fails explicitly instead of substituting a fallback Firebase project', () => {
    expect(() => createFirebaseConfig({})).toThrow(FirebaseConfigurationError);

    try {
      createFirebaseConfig({  it('allows Firebase Storage bucket to be omitted when the app only uses Auth and Firestore', () => {
    const config = createFirebaseConfig({
      apiKey: 'synthetic-api-key',
      authDomain: 'medicare-ai-staging.firebaseapp.com',
      projectId: 'medicare-ai-staging',
      messagingSenderId: '318128431668',
      appId: '1:318128431668:web:synthetic-web-app-id',
    });

    expect(config.projectId).toBe('medicare-ai-staging');
    expect(config.storageBucket).toBeUndefined();
  });
});
    } catch (error) {
      expect(error).toBeInstanceOf(FirebaseConfigurationError);
      expect((error as FirebaseConfigurationError).missingVariables).toContain(
        'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
      );
    }
  });
});

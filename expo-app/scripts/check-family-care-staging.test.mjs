import assert from 'node:assert/strict';
import test from 'node:test';

import { validateFamilyCareStagingEnv } from './check-family-care-staging.mjs';

const staging = 'medicare-ai-staging';
const production = 'medicare-ai-cf804';
const fixture = {
  EXPO_PUBLIC_FIREBASE_API_KEY: 'synthetic-api-key',
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: staging + '.firebaseapp.com',
  EXPO_PUBLIC_FIREBASE_PROJECT_ID: staging,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '318128431668',
  EXPO_PUBLIC_FIREBASE_APP_ID: '1:318128431668:web:synthetic-web-app-id',
  EXPO_PUBLIC_FIRESTORE_USER_PROFILES_ENABLED: 'true',
  EXPO_PUBLIC_FIRESTORE_MEDICATIONS_ENABLED: 'true',
  EXPO_PUBLIC_FIRESTORE_SCHEDULES_ENABLED: 'true',
  EXPO_PUBLIC_FAMILY_CARE_ENABLED: 'true',
};

test('passes explicit, isolated staging configuration', () => {
  assert.deepEqual(validateFamilyCareStagingEnv(fixture, staging, production), []);
});

test('blocks production even if CLI and environment match it', () => {
  const changed = {
    ...fixture, EXPO_PUBLIC_FIREBASE_PROJECT_ID: production,
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: production + '.firebaseapp.com',
  };
  assert.match(validateFamilyCareStagingEnv(changed, production, production).join(' '), /Production Firebase project/);
});

test('blocks accidental production config when staging is explicitly requested', () => {
  assert.ok(validateFamilyCareStagingEnv({
    ...fixture, EXPO_PUBLIC_FIREBASE_PROJECT_ID: production,
  }, staging, production).length > 0);
});

test('blocks a different Firebase staging project than the explicit target', () => {
  assert.match(validateFamilyCareStagingEnv({
    ...fixture, EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'other-staging',
  }, 'other-staging', production).join(' '), /Only the owner-approved Firebase staging project/);
});

test('requires the approved staging project number in both Web App identity fields', () => {
  const wrongSender = validateFamilyCareStagingEnv({
    ...fixture, EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '354989416256',
  }, staging, production).join(' ');
  assert.match(wrongSender, /Messaging sender ID/);
  const wrongApp = validateFamilyCareStagingEnv({
    ...fixture, EXPO_PUBLIC_FIREBASE_APP_ID: '1:354989416256:web:production-app-id',
  }, staging, production).join(' ');
  assert.match(wrongApp, /Web App ID/);
});

test('requires all four related Firestore and Family Care routing flags', () => {
  for (const flag of [
    'EXPO_PUBLIC_FIRESTORE_USER_PROFILES_ENABLED',
    'EXPO_PUBLIC_FIRESTORE_MEDICATIONS_ENABLED',
    'EXPO_PUBLIC_FIRESTORE_SCHEDULES_ENABLED',
    'EXPO_PUBLIC_FAMILY_CARE_ENABLED',
  ]) {
    assert.match(validateFamilyCareStagingEnv({
      ...fixture, [flag]: 'false',
    }, staging, production).join(' '), new RegExp(flag));
  }
});

test('rejects missing required config and Web App identities pointing to other projects', () => {
  const changed = {
    ...fixture, EXPO_PUBLIC_FIREBASE_API_KEY: ' ',
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'other-project.firebaseapp.com',
  };
  const issues = validateFamilyCareStagingEnv(changed, staging, production).join(' ');
  assert.match(issues, /EXPO_PUBLIC_FIREBASE_API_KEY/);
  assert.match(issues, /Auth domain/);
});

test('allows Storage bucket to be omitted because Family Care does not use Firebase Storage', () => {
  const { EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: _unused, ...withoutBucket } = fixture;
  assert.deepEqual(validateFamilyCareStagingEnv(withoutBucket, staging, production), []);
});

test('still rejects a Storage bucket that explicitly points to another project', () => {
  const changed = { ...fixture, EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: 'other-project.appspot.com' };
  assert.match(validateFamilyCareStagingEnv(changed, staging, production).join(' '), /Storage bucket/);
});

test('blocks the emulator project and project IDs not designated staging/test', () => {
  assert.match(validateFamilyCareStagingEnv({
    ...fixture, EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'medicare-ai-rules-test',
  }, 'medicare-ai-rules-test', production).join(' '), /Emulator project ID/);
  assert.match(validateFamilyCareStagingEnv({
    ...fixture, EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'some-live-app',
  }, 'some-live-app', production).join(' '), /staging\/test/);
});

test('fails closed if production project identity is unavailable', () => {
  assert.match(validateFamilyCareStagingEnv(fixture, staging, '').join(' '), /Cannot determine/);
});


test('blocks the known production project without relying on FlutterFire metadata', () => {
  const changed = {
    ...fixture,
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: production,
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: production + '.firebaseapp.com',
  };
  assert.match(
    validateFamilyCareStagingEnv(changed, staging, production).join(' '),
    /Production Firebase project is blocked/,
  );
});

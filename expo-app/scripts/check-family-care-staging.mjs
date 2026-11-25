import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

const requiredConfig = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
];
const requiredFlags = [
  'EXPO_PUBLIC_FIRESTORE_USER_PROFILES_ENABLED',
  'EXPO_PUBLIC_FIRESTORE_MEDICATIONS_ENABLED',
  'EXPO_PUBLIC_FIRESTORE_SCHEDULES_ENABLED',
  'EXPO_PUBLIC_FAMILY_CARE_ENABLED',
];
const inspectedKeys = new Set([...requiredConfig, ...requiredFlags]);
const approvedStagingProjectId = 'medicare-ai-staging';
const approvedStagingProjectNumber = '318128431668';

/**
 * Pure, offline validation. This is a local QA preflight, not a Firebase
 * authorization decision and not evidence that Rules were deployed.
 */
export function validateFamilyCareStagingEnv(values, expectedProject, productionProject) {
  const issues = [];
  const target = expectedProject?.trim() ?? '';
  const configured = values.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim() ?? '';

  if (!/^[a-z][a-z0-9-]{4,29}$/.test(target)
    || !/(?:^|-)(?:stage|staging|sandbox|test)(?:-|$)/.test(target)) {
    issues.push('Specify an explicit Firebase staging/test project ID using --project.');
  }
  if (target !== approvedStagingProjectId) {
    issues.push('Only the owner-approved Firebase staging project ' + approvedStagingProjectId + ' is allowed.');
  }
  if (!productionProject) {
    issues.push('Cannot determine the existing production project from firebase.json. Stop.');
  } else if (configured === productionProject || target === productionProject) {
    issues.push('Production Firebase project is blocked for this Family Care QA preflight.');
  }
  if (configured === 'medicare-ai-rules-test' || target === 'medicare-ai-rules-test') {
    issues.push('The Firestore Emulator project ID is not a Firebase staging project.');
  }
  if (!target || configured !== target) {
    issues.push('Configured Firebase project ID does not match the explicitly requested staging project.');
  }

  for (const name of requiredConfig) {
    if (!values[name]?.trim()) issues.push('Missing Firebase Web App field: ' + name);
  }
  for (const name of requiredFlags) {
    if (values[name]?.trim().toLowerCase() !== 'true') {
      issues.push('Required staging feature flag is not true: ' + name);
    }
  }

  if (configured && values.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() !== configured + '.firebaseapp.com') {
    issues.push('Firebase Auth domain does not match the staging project default domain.');
  }
  if (values.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() !== approvedStagingProjectNumber) {
    issues.push('Firebase Messaging sender ID does not match the approved staging project number.');
  }
  if (!values.EXPO_PUBLIC_FIREBASE_APP_ID?.trim().startsWith('1:' + approvedStagingProjectNumber + ':web:')) {
    issues.push('Firebase Web App ID does not match the approved staging project number.');
  }
  const bucket = values.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim();
  if (configured && bucket && bucket !== configured + '.appspot.com'
    && bucket !== configured + '.firebasestorage.app') {
    issues.push('Firebase Storage bucket does not match the staging project.');
  }
  return issues;
}

async function getOptionalFile(filename) {
  try {
    return await readFile(filename, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function runPreflight() {
  if (process.argv.length !== 4 || process.argv[2] !== '--project') {
    throw new Error('Usage: node scripts/check-family-care-staging.mjs --project <staging-project-id>');
  }
  const root = process.cwd();
  const envContents = await readFile(resolve(root, '.env'), 'utf8');
  const variables = parseEnv(envContents);
  const firebaseSettings = JSON.parse(await readFile(resolve(root, '../firebase.json'), 'utf8'));
  const productionProject = firebaseSettings.flutter?.platforms?.android?.default?.projectId
    ?? firebaseSettings.flutter?.platforms?.dart?.['lib/firebase_options.dart']?.projectId;

  const issues = validateFamilyCareStagingEnv(variables, process.argv[3], productionProject);

  // Expo may load environment overrides which this script would otherwise miss.
  for (const filename of ['.env.local', '.env.development', '.env.development.local']) {
    const contents = await getOptionalFile(resolve(root, filename));
    if (contents === null) continue;
    const overrides = parseEnv(contents);
    if (Object.keys(overrides).some((name) => inspectedKeys.has(name))) {
      issues.push('Potential Firebase or Family Care override in ' + filename
        + '. Remove it before this isolated staging test.');
    }
  }
  for (const name of inspectedKeys) {
    if (process.env[name] !== undefined && process.env[name] !== variables[name]) {
      issues.push('Shell environment overrides local staging value: ' + name);
    }
  }
  if (issues.length > 0) {
    throw new Error('Family Care staging preflight blocked:\n- ' + issues.join('\n- '));
  }
  console.log('PASS: explicit staging Firebase project, matching Web App identifiers, and required Family Care flags.');
  console.log('This does not verify deployed Security Rules, credentials, test accounts or device behavior.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await runPreflight();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

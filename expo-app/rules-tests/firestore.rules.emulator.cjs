const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} = require('firebase/firestore');

const projectId = 'medicare-ai-rules-test';
const rules = readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8');
const describeWithFirestoreEmulator = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

const userA = 'user-a';
const userB = 'user-b';
const caregiver = 'caregiver-a';

let testEnvironment;

function userProfile(uid, primaryRole = 'elderly', overrides = {}) {
  return {
    uid,
    displayName: 'Người dùng kiểm thử',
    primaryRole,
    roles: {
      elderly: primaryRole === 'elderly',
      caregiver: primaryRole === 'caregiver',
    },
    locale: 'vi',
    timeZone: 'Asia/Ho_Chi_Minh',
    onboardingCompleted: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function firestoreAs(uid) {
  return testEnvironment.authenticatedContext(uid, { email: `${uid}@example.test` }).firestore();
}

function userProfileReference(database, uid) {
  return doc(database, 'users', uid);
}

async function seed(documentPath, data) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), documentPath), data);
  });
}

describeWithFirestoreEmulator('Firestore user-profile rules', () => {
  beforeAll(async () => {
    testEnvironment = await initializeTestEnvironment({
      projectId,
      firestore: { rules },
    });
  });

  beforeEach(async () => {
    await testEnvironment.clearFirestore();
  });

  afterAll(async () => {
    await testEnvironment.cleanup();
  });

  it('allows User A to create one valid profile for User A', async () => {
    const database = firestoreAs(userA);

    await assertSucceeds(setDoc(userProfileReference(database, userA), userProfile(userA)));
  });

  it('allows the transaction-based initial profile write used by the repository', async () => {
    const database = firestoreAs(userA);
    const reference = userProfileReference(database, userA);

    await assertSucceeds(
      runTransaction(database, async (transaction) => {
        const existing = await transaction.get(reference);

        if (!existing.exists()) {
          transaction.set(reference, userProfile(userA));
        }
      }),
    );
  });

  it('allows User A to read only User A profile', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    const database = firestoreAs(userA);

    await assertSucceeds(getDoc(userProfileReference(database, userA)));
  });

  it('denies User A reading User B profile', async () => {
    await seed(`users/${userB}`, userProfile(userB));
    const database = firestoreAs(userA);

    await assertFails(getDoc(userProfileReference(database, userB)));
  });

  it('denies profile enumeration even to an authenticated owner', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    const database = firestoreAs(userA);

    await assertFails(getDocs(collection(database, 'users')));
  });

  it('denies changing a primary role after initial creation', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    const database = firestoreAs(userA);

    await assertFails(
      updateDoc(userProfileReference(database, userA), {
        primaryRole: 'caregiver',
        roles: { elderly: false, caregiver: true },
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('denies UID spoofing and privileged profile fields', async () => {
    const database = firestoreAs(userA);

    await assertFails(setDoc(userProfileReference(database, userB), userProfile(userB)));
    await assertFails(
      setDoc(
        userProfileReference(database, userA),
        userProfile(userA, 'elderly', { isAdministrator: true }),
      ),
    );
  });

  it('denies malformed profile schema, in-document UID spoofing, and forged timestamps', async () => {
    const database = firestoreAs(userA);
    const missingLocale = userProfile(userA);
    delete missingLocale.locale;

    const invalidProfiles = [
      userProfile(userA, 'elderly', { uid: userB }),
      userProfile(userA, 'elderly', { displayName: 42 }),
      userProfile(userA, 'administrator'),
      userProfile(userA, 'elderly', { roles: ['elderly'] }),
      userProfile(userA, 'elderly', { roles: { elderly: true, caregiver: true } }),
      userProfile(userA, 'elderly', { roles: { elderly: true, caregiver: false, administrator: false } }),
      userProfile(userA, 'elderly', { roles: { elderly: 'true', caregiver: false } }),
      userProfile(userA, 'caregiver', { roles: { elderly: true, caregiver: false } }),
      userProfile(userA, 'elderly', { locale: 'en' }),
      userProfile(userA, 'elderly', { timeZone: 'UTC' }),
      userProfile(userA, 'elderly', { onboardingCompleted: false }),
      userProfile(userA, 'elderly', { createdAt: 'not-a-timestamp' }),
      userProfile(userA, 'elderly', { updatedAt: 'not-a-timestamp' }),
      missingLocale,
    ];

    for (const invalidProfile of invalidProfiles) {
      await assertFails(setDoc(userProfileReference(database, userA), invalidProfile));
    }
  });

  it('denies unauthenticated profile reads and writes', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    const database = testEnvironment.unauthenticatedContext().firestore();

    await assertFails(getDoc(userProfileReference(database, userA)));
    await assertFails(setDoc(userProfileReference(database, userA), userProfile(userA)));
    await assertFails(
      updateDoc(userProfileReference(database, userA), {
        displayName: 'Tên trái phép',
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(deleteDoc(userProfileReference(database, userA)));
  });

  it('denies cross-user updates and deletes', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    const database = firestoreAs(userB);

    await assertFails(
      updateDoc(userProfileReference(database, userA), {
        displayName: 'Tên trái phép',
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(deleteDoc(userProfileReference(database, userA)));
  });

  it('denies caregiver access to health data without an active server-trusted link', async () => {
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, {
      elderlyId: userA,
      name: 'Dữ liệu giả lập',
    });
    const database = firestoreAs(caregiver);

    await assertFails(getDoc(doc(database, `elderlyProfiles/${userA}/medications/medication-a`)));
  });

  it('denies direct creation of an active caregiver link', async () => {
    const database = firestoreAs(caregiver);

    await assertFails(
      setDoc(doc(database, `elderlyProfiles/${userA}/caregiverLinks/${caregiver}`), {
        elderlyId: userA,
        caregiverId: caregiver,
        status: 'active',
      }),
    );
  });

  it('allows an explicit non-authority update to the owner profile', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    const database = firestoreAs(userA);

    await assertSucceeds(
      updateDoc(userProfileReference(database, userA), {
        displayName: 'Tên hiển thị mới',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('allows a transaction-based constrained owner update', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    const database = firestoreAs(userA);
    const reference = userProfileReference(database, userA);

    await assertSucceeds(
      runTransaction(database, async (transaction) => {
        await transaction.get(reference);
        transaction.update(reference, {
          displayName: 'Tên cập nhật bằng transaction',
          updatedAt: serverTimestamp(),
        });
      }),
    );
  });

  it('denies a transaction-based owner update that changes a role', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    const database = firestoreAs(userA);
    const reference = userProfileReference(database, userA);

    await assertFails(
      runTransaction(database, async (transaction) => {
        await transaction.get(reference);
        transaction.update(reference, {
          primaryRole: 'caregiver',
          roles: { elderly: false, caregiver: true },
          updatedAt: serverTimestamp(),
        });
      }),
    );
  });

  it('denies nested role changes, privileged field injection, immutable-field changes, and forged update timestamps', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    const database = firestoreAs(userA);
    const reference = userProfileReference(database, userA);

    await assertFails(updateDoc(reference, { 'roles.caregiver': true, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(reference, { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(reference, { onboardingCompleted: false, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(reference, { isAdministrator: true, updatedAt: serverTimestamp() }));
    await assertFails(
      updateDoc(reference, {
        displayName: 'Tên hợp lệ nhưng timestamp bị giả mạo',
        updatedAt: new Date('2000-01-01T00:00:00.000Z'),
      }),
    );
  });

  it('denies overwriting an existing profile to change role or creation metadata', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    const database = firestoreAs(userA);

    await assertFails(
      setDoc(
        userProfileReference(database, userA),
        userProfile(userA, 'caregiver'),
      ),
    );
  });

  it('denies deleting an existing profile', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    const database = firestoreAs(userA);

    await assertFails(deleteDoc(userProfileReference(database, userA)));
  });

  it('denies every deferred health, caregiver, device, and unknown surface to the profile owner', async () => {
    const database = firestoreAs(userA);
    const blockedWrites = [
      [`elderlyProfiles/${userA}/medications/medication-a`, { elderlyId: userA }],
      [`elderlyProfiles/${userA}/prescriptions/prescription-a`, { elderlyId: userA }],
      [`elderlyProfiles/${userA}/ocrResults/ocr-a`, { elderlyId: userA }],
      [`elderlyProfiles/${userA}/caregiverLinks/${caregiver}`, { elderlyId: userA, status: 'active' }],
      [`caregiverProfiles/${userA}`, { displayName: 'Dữ liệu tổng hợp' }],
      ['caregiverInvites/invite-a', { status: 'pending' }],
      [`users/${userA}/devices/device-a`, { token: 'synthetic-only' }],
      ['unexpectedCollection/record-a', { value: 'synthetic-only' }],
    ];

    for (const [path, data] of blockedWrites) {
      await assertFails(setDoc(doc(database, path), data));
    }
  });

  it('denies profile-owner reads from every deferred health and caregiver surface', async () => {
    const database = firestoreAs(userA);
    const blockedReads = [
      `elderlyProfiles/${userA}/medications/medication-a`,
      `elderlyProfiles/${userA}/prescriptions/prescription-a`,
      `elderlyProfiles/${userA}/ocrResults/ocr-a`,
      `elderlyProfiles/${userA}/caregiverLinks/${caregiver}`,
      `caregiverProfiles/${userA}`,
      'caregiverInvites/invite-a',
      `users/${userA}/devices/device-a`,
    ];

    for (const path of blockedReads) {
      await assertFails(getDoc(doc(database, path)));
    }
  });
});

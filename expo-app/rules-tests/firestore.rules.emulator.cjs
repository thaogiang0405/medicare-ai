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
  orderBy,
  query,
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

function medication(ownerUid, overrides = {}) {
  return {
    ownerUid,
    name: 'Paracetamol',
    strengthText: '500 mg',
    directionsText: 'Nội dung do người dùng cung cấp',
    status: 'active',
    revision: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function medicationReference(database, ownerUid, medicationId = 'medication-a') {
  return doc(database, 'elderlyProfiles', ownerUid, 'medications', medicationId);
}

function medicationsCollection(database, ownerUid) {
  return collection(database, 'elderlyProfiles', ownerUid, 'medications');
}

function medicationSchedule(ownerUid, overrides = {}) {
  return {
    ownerUid,
    medicationId: 'medication-a',
    recurrence: 'daily',
    localTime: '08:00',
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    startDate: '2026-11-19',
    endDate: null,
    timeZone: 'Asia/Ho_Chi_Minh',
    active: true,
    revision: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function medicationScheduleReference(database, ownerUid, scheduleId = 'schedule-a') {
  return doc(database, 'elderlyProfiles', ownerUid, 'medicationSchedules', scheduleId);
}

function medicationSchedulesCollection(database, ownerUid) {
  return collection(database, 'elderlyProfiles', ownerUid, 'medicationSchedules');
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
    await seed(`users/${caregiver}`, userProfile(caregiver, 'caregiver'));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, {
      ownerUid: userA,
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

  it('allows an elderly owner to create, get, and query only their own medication collection', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    const database = firestoreAs(userA);
    const reference = medicationReference(database, userA);

    await assertSucceeds(setDoc(reference, medication(userA)));
    await assertSucceeds(getDoc(reference));
    await assertSucceeds(getDocs(query(medicationsCollection(database, userA), orderBy('updatedAt', 'desc'))));
  });

  it('allows an elderly owner to update and inactivate medication records with server timestamps and revisions', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, medication(userA));
    const database = firestoreAs(userA);
    const reference = medicationReference(database, userA);

    await assertSucceeds(
      updateDoc(reference, {
        name: 'Paracetamol đã cập nhật',
        revision: 2,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(reference, {
        status: 'inactive',
        revision: 3,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('allows the transaction-backed medication update used by the repository', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, medication(userA));
    const database = firestoreAs(userA);
    const reference = medicationReference(database, userA);

    await assertSucceeds(
      runTransaction(database, async (transaction) => {
        await transaction.get(reference);
        transaction.update(reference, {
          directionsText: 'Nội dung đã cập nhật bởi chủ tài khoản',
          revision: 2,
          updatedAt: serverTimestamp(),
        });
      }),
    );
  });

  it('denies unauthenticated medication get, list, create, update, and delete', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, medication(userA));
    const database = testEnvironment.unauthenticatedContext().firestore();
    const reference = medicationReference(database, userA);

    await assertFails(getDoc(reference));
    await assertFails(getDocs(medicationsCollection(database, userA)));
    await assertFails(setDoc(medicationReference(database, userA, 'new-medication'), medication(userA)));
    await assertFails(updateDoc(reference, { name: 'Trái phép', revision: 2, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(reference));
  });

  it('denies every cross-user medication operation even when both users have elderly profiles', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`users/${userB}`, userProfile(userB));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, medication(userA));
    const database = firestoreAs(userB);
    const reference = medicationReference(database, userA);

    await assertFails(getDoc(reference));
    await assertFails(getDocs(medicationsCollection(database, userA)));
    await assertFails(setDoc(medicationReference(database, userA, 'new-medication'), medication(userA)));
    await assertFails(updateDoc(reference, { name: 'Trái phép', revision: 2, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(reference));
  });

  it('denies a caregiver medication access even on a path matching the caregiver UID', async () => {
    await seed(`users/${caregiver}`, userProfile(caregiver, 'caregiver'));
    await seed(`elderlyProfiles/${caregiver}/medications/medication-a`, medication(caregiver));
    const database = firestoreAs(caregiver);
    const reference = medicationReference(database, caregiver);

    await assertFails(getDoc(reference));
    await assertFails(getDocs(medicationsCollection(database, caregiver)));
    await assertFails(setDoc(medicationReference(database, caregiver, 'new-medication'), medication(caregiver)));
    await assertFails(updateDoc(reference, { name: 'Trái phép', revision: 2, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(reference));
  });

  it('denies owner UID spoofing, immutable fields, invalid revisions, and reactivation', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, medication(userA));
    await seed(
      `elderlyProfiles/${userA}/medications/medication-inactive`,
      medication(userA, { status: 'inactive' }),
    );
    const database = firestoreAs(userA);
    const reference = medicationReference(database, userA);

    await assertFails(setDoc(medicationReference(database, userA, 'spoofed-owner'), medication(userB)));
    await assertFails(updateDoc(reference, { ownerUid: userB, revision: 2, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(reference, { createdAt: serverTimestamp(), revision: 2, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(reference, { name: 'Revision không tăng', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(reference, { name: 'Revision nhảy cóc', revision: 3, updatedAt: serverTimestamp() }));
    await assertFails(
      updateDoc(medicationReference(database, userA, 'medication-inactive'), {
        status: 'active',
        revision: 2,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('denies malformed medication schemas and forged timestamps', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    const database = firestoreAs(userA);
    const invalidDocuments = [
      medication(userA, { extraPrivilegedField: true }),
      medication(userA, { name: '   ' }),
      medication(userA, { name: 42 }),
      medication(userA, { name: 'x'.repeat(121) }),
      medication(userA, { strengthText: 'x'.repeat(81) }),
      medication(userA, { strengthText: 500 }),
      medication(userA, { directionsText: 'x'.repeat(501) }),
      medication(userA, { directionsText: ['Không hợp lệ'] }),
      medication(userA, { status: 'deleted' }),
      medication(userA, { status: 'inactive' }),
      medication(userA, { revision: 2 }),
      medication(userA, { revision: '1' }),
      medication(userA, { createdAt: new Date('2000-01-01T00:00:00.000Z') }),
      medication(userA, { updatedAt: new Date('2000-01-01T00:00:00.000Z') }),
    ];

    for (const [index, data] of invalidDocuments.entries()) {
      await assertFails(setDoc(medicationReference(database, userA, `invalid-${index}`), data));
    }
  });

  it('denies deleting medication records for the owner', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, medication(userA));
    const database = firestoreAs(userA);

    await assertFails(deleteDoc(medicationReference(database, userA)));
  });

  it('allows an elderly owner to create, get, list, and query schedules for an active own medication', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, medication(userA));
    const database = firestoreAs(userA);
    const reference = medicationScheduleReference(database, userA);

    await assertSucceeds(setDoc(reference, medicationSchedule(userA)));
    await assertSucceeds(getDoc(reference));
    await assertSucceeds(
      getDocs(query(medicationSchedulesCollection(database, userA), orderBy('updatedAt', 'desc'))),
    );
  });

  it('allows transaction-backed schedule edits and a safe pause for an owner', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, medication(userA));
    await seed(`elderlyProfiles/${userA}/medicationSchedules/schedule-a`, medicationSchedule(userA));
    const database = firestoreAs(userA);
    const reference = medicationScheduleReference(database, userA);

    await assertSucceeds(
      runTransaction(database, async (transaction) => {
        await transaction.get(reference);
        transaction.update(reference, {
          recurrence: 'weekly',
          weekdays: [1, 3, 5],
          localTime: '09:30',
          revision: 2,
          updatedAt: serverTimestamp(),
        });
      }),
    );
    await assertSucceeds(
      runTransaction(database, async (transaction) => {
        await transaction.get(reference);
        transaction.update(reference, {
          active: false,
          revision: 3,
          updatedAt: serverTimestamp(),
        });
      }),
    );
  });

  it('denies unauthenticated schedule get, list, create, update, and delete', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, medication(userA));
    await seed(`elderlyProfiles/${userA}/medicationSchedules/schedule-a`, medicationSchedule(userA));
    const database = testEnvironment.unauthenticatedContext().firestore();
    const reference = medicationScheduleReference(database, userA);

    await assertFails(getDoc(reference));
    await assertFails(getDocs(medicationSchedulesCollection(database, userA)));
    await assertFails(setDoc(medicationScheduleReference(database, userA, 'new-schedule'), medicationSchedule(userA)));
    await assertFails(updateDoc(reference, { localTime: '09:00', revision: 2, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(reference));
  });

  it('denies every cross-user schedule operation even with two elderly profiles', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`users/${userB}`, userProfile(userB));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, medication(userA));
    await seed(`elderlyProfiles/${userA}/medicationSchedules/schedule-a`, medicationSchedule(userA));
    const database = firestoreAs(userB);
    const reference = medicationScheduleReference(database, userA);

    await assertFails(getDoc(reference));
    await assertFails(getDocs(medicationSchedulesCollection(database, userA)));
    await assertFails(setDoc(medicationScheduleReference(database, userA, 'new-schedule'), medicationSchedule(userA)));
    await assertFails(updateDoc(reference, { localTime: '09:00', revision: 2, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(reference));
  });

  it('denies caregiver schedule access even on a path matching the caregiver UID', async () => {
    await seed(`users/${caregiver}`, userProfile(caregiver, 'caregiver'));
    await seed(`elderlyProfiles/${caregiver}/medications/medication-a`, medication(caregiver));
    await seed(`elderlyProfiles/${caregiver}/medicationSchedules/schedule-a`, medicationSchedule(caregiver));
    const database = firestoreAs(caregiver);
    const reference = medicationScheduleReference(database, caregiver);

    await assertFails(getDoc(reference));
    await assertFails(getDocs(medicationSchedulesCollection(database, caregiver)));
    await assertFails(setDoc(medicationScheduleReference(database, caregiver, 'new-schedule'), medicationSchedule(caregiver)));
    await assertFails(updateDoc(reference, { localTime: '09:00', revision: 2, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(reference));
  });

  it('denies schedule creation for missing, inactive, and foreign medication references', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`elderlyProfiles/${userA}/medications/medication-inactive`, medication(userA, { status: 'inactive' }));
    await seed(`elderlyProfiles/${userB}/medications/medication-foreign`, medication(userB));
    const database = firestoreAs(userA);

    await assertFails(
      setDoc(
        medicationScheduleReference(database, userA, 'missing-medication'),
        medicationSchedule(userA),
      ),
    );
    await assertFails(
      setDoc(
        medicationScheduleReference(database, userA, 'inactive-medication'),
        medicationSchedule(userA, { medicationId: 'medication-inactive' }),
      ),
    );
    await assertFails(
      setDoc(
        medicationScheduleReference(database, userA, 'foreign-medication'),
        medicationSchedule(userA, { medicationId: 'medication-foreign' }),
      ),
    );
  });

  it('denies malformed schedule schema, invalid actual dates, local times, weekdays, and forged timestamps', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, medication(userA));
    const database = firestoreAs(userA);
    const invalidSchedules = [
      medicationSchedule(userA, { extraPrivilegedField: true }),
      medicationSchedule(userA, { ownerUid: userB }),
      medicationSchedule(userA, { medicationId: 'other/medication' }),
      medicationSchedule(userA, { recurrence: 'monthly' }),
      medicationSchedule(userA, { localTime: '24:00' }),
      medicationSchedule(userA, { localTime: '8:00' }),
      medicationSchedule(userA, { weekdays: [1, 1] }),
      medicationSchedule(userA, { weekdays: [0, 8] }),
      medicationSchedule(userA, { recurrence: 'daily', weekdays: [1, 2] }),
      medicationSchedule(userA, { recurrence: 'weekly', weekdays: [] }),
      medicationSchedule(userA, { startDate: '2026-02-30' }),
      medicationSchedule(userA, { startDate: '1999-12-31' }),
      medicationSchedule(userA, { endDate: '2026-02-30' }),
      medicationSchedule(userA, { endDate: '2026-11-18' }),
      medicationSchedule(userA, { timeZone: 'UTC' }),
      medicationSchedule(userA, { active: false }),
      medicationSchedule(userA, { revision: 2 }),
      medicationSchedule(userA, { createdAt: new Date('2000-01-01T00:00:00.000Z') }),
      medicationSchedule(userA, { updatedAt: new Date('2000-01-01T00:00:00.000Z') }),
    ];

    for (const [index, data] of invalidSchedules.entries()) {
      await assertFails(setDoc(medicationScheduleReference(database, userA, `invalid-schedule-${index}`), data));
    }
  });

  it('denies owner or medication spoofing, immutable-field updates, bad revisions, reactivation, and delete', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, medication(userA));
    await seed(`elderlyProfiles/${userA}/medicationSchedules/schedule-a`, medicationSchedule(userA));
    await seed(
      `elderlyProfiles/${userA}/medicationSchedules/schedule-inactive`,
      medicationSchedule(userA, { active: false }),
    );
    const database = firestoreAs(userA);
    const reference = medicationScheduleReference(database, userA);
    const inactiveReference = medicationScheduleReference(database, userA, 'schedule-inactive');

    await assertFails(updateDoc(reference, { ownerUid: userB, revision: 2, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(reference, { medicationId: 'other-medication', revision: 2, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(reference, { createdAt: serverTimestamp(), revision: 2, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(reference, { localTime: '09:00', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(reference, { localTime: '09:00', revision: 3, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(inactiveReference, { active: true, revision: 2, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(reference));
  });

  it('allows an owner to pause an existing schedule after its medication becomes inactive', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, medication(userA, { status: 'inactive' }));
    await seed(`elderlyProfiles/${userA}/medicationSchedules/schedule-a`, medicationSchedule(userA));
    const database = firestoreAs(userA);

    await assertSucceeds(
      updateDoc(medicationScheduleReference(database, userA), {
        active: false,
        revision: 2,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it('denies every deferred health, caregiver, device, and unknown surface to the profile owner', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    const database = firestoreAs(userA);
    const blockedWrites = [
      [`elderlyProfiles/${userA}/prescriptions/prescription-a`, { elderlyId: userA }],
      [`elderlyProfiles/${userA}/ocrResults/ocr-a`, { elderlyId: userA }],
      [`elderlyProfiles/${userA}/caregiverLinks/${caregiver}`, { elderlyId: userA, status: 'active' }],
      [`elderlyProfiles/${userA}/doseEvents/dose-a`, { elderlyId: userA, status: 'pending' }],
      [`elderlyProfiles/${userA}/notifications/notification-a`, { elderlyId: userA, deliveryState: 'pending' }],
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
    await seed(`users/${userA}`, userProfile(userA));
    const database = firestoreAs(userA);
    const blockedReads = [
      `elderlyProfiles/${userA}/prescriptions/prescription-a`,
      `elderlyProfiles/${userA}/ocrResults/ocr-a`,
      `elderlyProfiles/${userA}/caregiverLinks/${caregiver}`,
      `elderlyProfiles/${userA}/doseEvents/dose-a`,
      `elderlyProfiles/${userA}/notifications/notification-a`,
      `caregiverProfiles/${userA}`,
      'caregiverInvites/invite-a',
      `users/${userA}/devices/device-a`,
    ];

    for (const path of blockedReads) {
      await assertFails(getDoc(doc(database, path)));
    }
  });
});

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const {
  collection,
  collectionGroup,
  documentId,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
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

function doseEvent(ownerUid, overrides = {}) {
  const status = overrides.status ?? 'reportedTaken';
  const respondedBy = overrides.respondedBy ?? ownerUid;

  return {
    ownerUid,
    scheduleId: 'schedule-a',
    medicationId: 'medication-a',
    occurrenceKey: '2020-01-01T08:00@Asia/Ho_Chi_Minh',
    scheduledAt: new Date('2020-01-01T01:00:00.000Z'),
    scheduledLocalDate: '2020-01-01',
    scheduledLocalTime: '08:00',
    timeZone: 'Asia/Ho_Chi_Minh',
    medicationSnapshot: {
      name: 'Paracetamol',
      strengthText: '500 mg',
      directionsText: 'Nội dung do người dùng cung cấp',
    },
    status,
    responseSource: 'selfReported',
    respondedAt: serverTimestamp(),
    respondedBy,
    responseHistory: {
      initial: {
        status,
        responseSource: 'selfReported',
        respondedAt: serverTimestamp(),
        respondedBy,
      },
    },
    revision: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...overrides,
  };
}

function doseEventReference(database, ownerUid, eventId = 'schedule-a__2020-01-01__08:00') {
  return doc(database, 'elderlyProfiles', ownerUid, 'doseEvents', eventId);
}

function doseEventsCollection(database, ownerUid) {
  return collection(database, 'elderlyProfiles', ownerUid, 'doseEvents');
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

  it('allows an elderly owner to create, get, list, and transaction-create one immutable self-reported dose event', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, medication(userA));
    await seed(
      `elderlyProfiles/${userA}/medicationSchedules/schedule-a`,
      medicationSchedule(userA, { startDate: '2020-01-01' }),
    );
    const database = firestoreAs(userA);
    const reference = doseEventReference(database, userA);

    await assertSucceeds(setDoc(reference, doseEvent(userA)));
    await assertSucceeds(getDoc(reference));
    await assertSucceeds(getDocs(doseEventsCollection(database, userA)));
    await assertSucceeds(getDocs(query(
      doseEventsCollection(database, userA),
      where('scheduledLocalDate', '>=', '2020-01-01'),
      where('scheduledLocalDate', '<=', '2020-01-07'),
      orderBy('scheduledLocalDate', 'desc'),
      orderBy('scheduledLocalTime', 'desc'),
      orderBy(documentId(), 'desc'),
    )));

    const transactionReference = doseEventReference(
      database,
      userA,
      'schedule-a__2020-01-02__08:00',
    );
    await assertSucceeds(
      runTransaction(database, async (transaction) => {
        const existing = await transaction.get(transactionReference);
        if (!existing.exists()) {
          transaction.set(transactionReference, doseEvent(userA, {
            occurrenceKey: '2020-01-02T08:00@Asia/Ho_Chi_Minh',
            scheduledLocalDate: '2020-01-02',
            scheduledAt: new Date('2020-01-02T01:00:00.000Z'),
          }));
        }
      }),
    );
  });

  it('keeps immutable historical DoseEvents readable after its schedule or medication is inactive', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, medication(userA, { status: 'inactive' }));
    await seed(
      `elderlyProfiles/${userA}/medicationSchedules/schedule-a`,
      medicationSchedule(userA, { startDate: '2020-01-01', active: false }),
    );
    await seed(`elderlyProfiles/${userA}/doseEvents/schedule-a__2020-01-01__08:00`, doseEvent(userA));

    await assertSucceeds(getDocs(query(
      doseEventsCollection(firestoreAs(userA), userA),
      where('scheduledLocalDate', '>=', '2020-01-01'),
      where('scheduledLocalDate', '<=', '2020-01-07'),
      orderBy('scheduledLocalDate', 'desc'),
      orderBy('scheduledLocalTime', 'desc'),
      orderBy(documentId(), 'desc'),
    )));
  });

  it('denies unauthenticated, cross-user, and caregiver dose event access', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`users/${userB}`, userProfile(userB));
    await seed(`users/${caregiver}`, userProfile(caregiver, 'caregiver'));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, medication(userA));
    await seed(
      `elderlyProfiles/${userA}/medicationSchedules/schedule-a`,
      medicationSchedule(userA, { startDate: '2020-01-01' }),
    );
    await seed(`elderlyProfiles/${userA}/doseEvents/schedule-a__2020-01-01__08:00`, doseEvent(userA));

    const unauthenticated = testEnvironment.unauthenticatedContext().firestore();
    const crossUser = firestoreAs(userB);
    const caregiverDatabase = firestoreAs(caregiver);

    for (const database of [unauthenticated, crossUser, caregiverDatabase]) {
      await assertFails(getDoc(doseEventReference(database, userA)));
      await assertFails(getDocs(doseEventsCollection(database, userA)));
      await assertFails(setDoc(doseEventReference(database, userA, 'schedule-a__2020-01-02__08:00'), doseEvent(userA, {
        occurrenceKey: '2020-01-02T08:00@Asia/Ho_Chi_Minh',
        scheduledLocalDate: '2020-01-02',
        scheduledAt: new Date('2020-01-02T01:00:00.000Z'),
      })));
    }
  });

  it('denies a dose event without an active same-owner schedule and medication', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, medication(userA));
    await seed(`elderlyProfiles/${userA}/medicationSchedules/schedule-a`, medicationSchedule(userA, {
      startDate: '2020-01-01',
      active: false,
    }));
    const database = firestoreAs(userA);

    await assertFails(setDoc(doseEventReference(database, userA), doseEvent(userA)));

    await testEnvironment.clearFirestore();
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, medication(userA, { status: 'inactive' }));
    await seed(
      `elderlyProfiles/${userA}/medicationSchedules/schedule-a`,
      medicationSchedule(userA, { startDate: '2020-01-01' }),
    );
    await assertFails(setDoc(doseEventReference(database, userA), doseEvent(userA)));
  });

  it('denies a self-report on a weekday excluded by a weekly schedule', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, medication(userA));
    await seed(
      `elderlyProfiles/${userA}/medicationSchedules/schedule-a`,
      medicationSchedule(userA, {
        startDate: '2020-01-01',
        recurrence: 'weekly',
        weekdays: [1],
      }),
    );

    // 2020-01-01 was Wednesday in Asia/Ho_Chi_Minh, not Monday.
    await assertFails(setDoc(
      doseEventReference(firestoreAs(userA), userA),
      doseEvent(userA),
    ));
  });

  it('denies a self-report whose UTC instant does not match its claimed HCM date and time', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, medication(userA));
    await seed(
      `elderlyProfiles/${userA}/medicationSchedules/schedule-a`,
      medicationSchedule(userA, { startDate: '2020-01-01' }),
    );
    const database = firestoreAs(userA);

    await assertFails(setDoc(
      doseEventReference(database, userA),
      doseEvent(userA, { scheduledAt: new Date('2020-01-01T02:00:00.000Z') }),
    ));
    await assertFails(setDoc(
      doseEventReference(database, userA, 'schedule-a__2020-01-02__08:00'),
      doseEvent(userA, {
        occurrenceKey: '2020-01-02T08:00@Asia/Ho_Chi_Minh',
        scheduledLocalDate: '2020-01-02',
        scheduledAt: new Date('2020-01-01T01:00:00.000Z'),
      }),
    ));
  });

  it('denies spoofed owner or references, invalid ID/key/schema, future events, and forged timestamps', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, medication(userA));
    await seed(
      `elderlyProfiles/${userA}/medicationSchedules/schedule-a`,
      medicationSchedule(userA, { startDate: '2020-01-01' }),
    );
    const database = firestoreAs(userA);
    const invalidEvents = [
      doseEvent(userB),
      doseEvent(userA, { scheduleId: 'schedule-b' }),
      doseEvent(userA, { medicationId: 'medication-b' }),
      doseEvent(userA, { occurrenceKey: 'forged' }),
      doseEvent(userA, { status: 'pending' }),
      doseEvent(userA, { responseSource: 'automated' }),
      doseEvent(userA, { medicationSnapshot: { name: 'Khác', strengthText: '500 mg', directionsText: 'Nội dung do người dùng cung cấp' } }),
      doseEvent(userA, { revision: 2 }),
      doseEvent(userA, { scheduledAt: new Date('2999-01-01T00:00:00.000Z') }),
      doseEvent(userA, { createdAt: new Date('2000-01-01T00:00:00.000Z') }),
      doseEvent(userA, { extraPrivilegedField: true }),
    ];

    for (const [index, data] of invalidEvents.entries()) {
      await assertFails(setDoc(doseEventReference(database, userA, `invalid-dose-${index}`), data));
    }

    await assertFails(setDoc(
      doseEventReference(database, userA, 'wrong__id'),
      doseEvent(userA),
    ));
  });

  it('denies overwriting, status transitions, and deleting an existing dose event', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    await seed(`elderlyProfiles/${userA}/medications/medication-a`, medication(userA));
    await seed(
      `elderlyProfiles/${userA}/medicationSchedules/schedule-a`,
      medicationSchedule(userA, { startDate: '2020-01-01' }),
    );
    await seed(`elderlyProfiles/${userA}/doseEvents/schedule-a__2020-01-01__08:00`, doseEvent(userA));
    const database = firestoreAs(userA);
    const reference = doseEventReference(database, userA);

    await assertFails(updateDoc(reference, { status: 'reportedSkipped', updatedAt: serverTimestamp() }));
    await assertFails(setDoc(reference, doseEvent(userA, { status: 'reportedSkipped' })));
    await assertFails(deleteDoc(reference));
  });

  it('denies every deferred health, caregiver, device, and unknown surface to the profile owner', async () => {
    await seed(`users/${userA}`, userProfile(userA));
    const database = firestoreAs(userA);
    const blockedWrites = [
      [`elderlyProfiles/${userA}/prescriptions/prescription-a`, { elderlyId: userA }],
      [`elderlyProfiles/${userA}/ocrResults/ocr-a`, { elderlyId: userA }],
      [`elderlyProfiles/${userA}/caregiverLinks/${caregiver}`, { elderlyId: userA, status: 'active' }],
      [`elderlyProfiles/${userA}/notifications/notification-a`, { elderlyId: userA, deliveryState: 'pending' }],
      [`elderlyProfiles/${userA}/auditLogs/audit-a`, { elderlyId: userA, action: 'synthetic-only' }],
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
      `elderlyProfiles/${userA}/notifications/notification-a`,
      `elderlyProfiles/${userA}/auditLogs/audit-a`,
      `caregiverProfiles/${userA}`,
      'caregiverInvites/invite-a',
      `users/${userA}/devices/device-a`,
    ];

    for (const path of blockedReads) {
      await assertFails(getDoc(doc(database, path)));
    }
  });
  function familyLink(ownerUid, caregiverUid, overrides = {}) {
    return {
      ownerUid,
      caregiverUid,
      status: 'active',
      scopes: { medicationsRead: true, schedulesRead: true },
      revision: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...overrides,
    };
  }

  function familyLinkRef(database, ownerUid = userA, caregiverUid = caregiver) {
    return doc(database, 'elderlyProfiles', ownerUid, 'caregiverLinks', caregiverUid);
  }

  const familyInviteCode = 'AbCdEfGhIjKlMnOpQrSt';

  function familyInvite(ownerUid, inviteCode = familyInviteCode, overrides = {}) {
    return {
      ownerUid,
      ownerDisplayName: 'Người dùng kiểm thử',
      inviteCode,
      status: 'open',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      claimedByUid: null,
      claimedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...overrides,
    };
  }

  function pendingFamilyLink(ownerUid, caregiverUid, inviteCode = familyInviteCode, overrides = {}) {
    return {
      ownerUid,
      ownerDisplayName: 'Người dùng kiểm thử',
      caregiverUid,
      caregiverDisplayName: 'Người dùng kiểm thử',
      inviteCode,
      status: 'pending',
      scopes: { medicationsRead: true, schedulesRead: true },
      revision: 1,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...overrides,
    };
  }

  it('claims a one-time invite, creates a pending link, and grants health reads only after owner approval', async () => {
    await seed('users/' + userA, userProfile(userA));
    await seed('users/' + caregiver, userProfile(caregiver, 'caregiver'));
    await seed('elderlyProfiles/' + userA + '/medications/medication-a', medication(userA));
    const ownerDB = firestoreAs(userA);
    const caregiverDB = firestoreAs(caregiver);
    const invitation = doc(ownerDB, 'familyInvites', familyInviteCode);
    const caregiverInvitation = doc(caregiverDB, 'familyInvites', familyInviteCode);
    const ownerLink = familyLinkRef(ownerDB);
    const caregiverLink = familyLinkRef(caregiverDB);

    await assertSucceeds(setDoc(invitation, familyInvite(userA)));
    await assertSucceeds(getDoc(caregiverInvitation));
    await assertFails(getDoc(medicationReference(caregiverDB, userA)));
    await assertFails(runTransaction(caregiverDB, async (transaction) => {
      await transaction.get(caregiverInvitation);
      await transaction.get(caregiverLink);
      await transaction.get(userProfileReference(caregiverDB, caregiver));
      transaction.set(caregiverLink, pendingFamilyLink(userA, caregiver));
    }));

    await assertSucceeds(runTransaction(caregiverDB, async (transaction) => {
      const inviteSnapshot = await transaction.get(caregiverInvitation);
      expect(inviteSnapshot.data().status).toBe('open');
      transaction.update(caregiverInvitation, {
        status: 'claimed', claimedByUid: caregiver, claimedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }));
    expect((await assertSucceeds(getDoc(caregiverLink))).exists()).toBe(false);
    await assertSucceeds(runTransaction(caregiverDB, async (transaction) => {
      const inviteSnapshot = await transaction.get(caregiverInvitation);
      const existingLink = await transaction.get(caregiverLink);
      const caregiverProfile = await transaction.get(userProfileReference(caregiverDB, caregiver));
      expect(inviteSnapshot.data().status).toBe('claimed');
      expect(inviteSnapshot.data().claimedByUid).toBe(caregiver);
      expect(existingLink.exists()).toBe(false);
      expect(caregiverProfile.data().primaryRole).toBe('caregiver');
      transaction.set(caregiverLink, pendingFamilyLink(userA, caregiver));
    }));

    expect((await assertSucceeds(getDoc(caregiverLink))).data().status).toBe('pending');
    await assertFails(getDoc(medicationReference(caregiverDB, userA)));
    const caregiverLinks = await assertSucceeds(getDocs(query(
      collectionGroup(caregiverDB, 'caregiverLinks'),
      where('caregiverUid', '==', caregiver),
    )));
    expect(caregiverLinks.size).toBe(1);
    expect(caregiverLinks.docs[0].data().status).toBe('pending');

    await assertSucceeds(runTransaction(ownerDB, async (transaction) => {
      const linkSnapshot = await transaction.get(ownerLink);
      const inviteSnapshot = await transaction.get(invitation);
      expect(linkSnapshot.data().status).toBe('pending');
      expect(inviteSnapshot.data().status).toBe('claimed');
      transaction.update(invitation, { status: 'consumed', updatedAt: serverTimestamp() });
    }));
    expect((await assertSucceeds(getDoc(ownerLink))).data().status).toBe('pending');
    await assertFails(getDoc(medicationReference(caregiverDB, userA)));
    await assertFails(updateDoc(ownerLink, {
      status: 'active', revision: 2, updatedAt: serverTimestamp(),
      scopes: { medicationsRead: false, schedulesRead: true },
    }));
    await assertSucceeds(runTransaction(ownerDB, async (transaction) => {
      const linkSnapshot = await transaction.get(ownerLink);
      const inviteSnapshot = await transaction.get(invitation);
      expect(linkSnapshot.data().status).toBe('pending');
      expect(inviteSnapshot.data().status).toBe('consumed');
      transaction.update(ownerLink, { status: 'active', revision: 2, updatedAt: serverTimestamp() });
    }));

    expect((await assertSucceeds(getDoc(caregiverLink))).data().status).toBe('active');
    await assertSucceeds(getDoc(medicationReference(caregiverDB, userA)));
    await assertFails(getDoc(caregiverInvitation));
  });

  it('allows only the first caregiver to claim an invite and prevents a second claimant', async () => {
    await seed('users/' + userA, userProfile(userA));
    await seed('users/' + caregiver, userProfile(caregiver, 'caregiver'));
    await seed('users/caregiver-b', userProfile('caregiver-b', 'caregiver'));
    const ownerDB = firestoreAs(userA);
    const firstDB = firestoreAs(caregiver);
    const secondDB = firestoreAs('caregiver-b');
    const ownerInvite = doc(ownerDB, 'familyInvites', familyInviteCode);
    const firstInvite = doc(firstDB, 'familyInvites', familyInviteCode);
    const secondInvite = doc(secondDB, 'familyInvites', familyInviteCode);
    await assertSucceeds(setDoc(ownerInvite, familyInvite(userA)));

    await assertSucceeds(runTransaction(firstDB, async (transaction) => {
      await transaction.get(firstInvite);
      transaction.update(firstInvite, {
        status: 'claimed', claimedByUid: caregiver, claimedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }));
    await assertSucceeds(runTransaction(firstDB, async (transaction) => {
      await transaction.get(firstInvite);
      await transaction.get(familyLinkRef(firstDB));
      await transaction.get(userProfileReference(firstDB, caregiver));
      transaction.set(familyLinkRef(firstDB), pendingFamilyLink(userA, caregiver));
    }));
    await assertFails(getDoc(secondInvite));
    await assertFails(runTransaction(secondDB, async (transaction) => {
      await transaction.get(secondInvite);
      await transaction.get(familyLinkRef(secondDB));
      await transaction.get(userProfileReference(secondDB, 'caregiver-b'));
      transaction.update(secondInvite, {
        status: 'claimed', claimedByUid: 'caregiver-b', claimedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      transaction.set(familyLinkRef(secondDB), pendingFamilyLink(userA, 'caregiver-b'));
    }));
  });

  it('denies expired invites, non-caregiver claims, malformed invite IDs, and forged owner identity', async () => {
    await seed('users/' + userA, userProfile(userA));
    await seed('users/' + userB, userProfile(userB));
    await seed('users/' + caregiver, userProfile(caregiver, 'caregiver'));
    const ownerDB = firestoreAs(userA);
    const caregiverDB = firestoreAs(caregiver);
    const elderlyDB = firestoreAs(userB);
    const validInvite = doc(ownerDB, 'familyInvites', familyInviteCode);
    await assertSucceeds(setDoc(validInvite, familyInvite(userA)));
    await assertFails(getDoc(doc(elderlyDB, 'familyInvites', familyInviteCode)));
    await assertFails(setDoc(doc(ownerDB, 'familyInvites', 'short-code'), familyInvite(userA, 'short-code')));
    const forgedCode = 'ZzYyXxWwVvUuTtSsRrQq';
    await assertFails(setDoc(doc(ownerDB, 'familyInvites', forgedCode), familyInvite(userB, forgedCode)));
    const expiredCode = 'ExpiredInviteCode123';
    await seed('familyInvites/' + expiredCode, familyInvite(userA, expiredCode, {
      expiresAt: new Date(Date.now() - 60 * 1000),
    }));
    await assertFails(getDoc(doc(caregiverDB, 'familyInvites', expiredCode)));
  });

  it('requires owner approval to consume or reject a pending request and never grants health access on rejection', async () => {
    await seed('users/' + userA, userProfile(userA));
    await seed('users/' + caregiver, userProfile(caregiver, 'caregiver'));
    await seed('elderlyProfiles/' + userA + '/medications/medication-a', medication(userA));
    const ownerDB = firestoreAs(userA);
    const caregiverDB = firestoreAs(caregiver);
    const invitation = doc(ownerDB, 'familyInvites', familyInviteCode);
    const inviteForCaregiver = doc(caregiverDB, 'familyInvites', familyInviteCode);
    const ownerLink = familyLinkRef(ownerDB);
    const caregiverLink = familyLinkRef(caregiverDB);
    await assertSucceeds(setDoc(invitation, familyInvite(userA)));
    await assertSucceeds(runTransaction(caregiverDB, async (transaction) => {
      await transaction.get(inviteForCaregiver);
      transaction.update(inviteForCaregiver, {
        status: 'claimed', claimedByUid: caregiver, claimedAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }));
    await assertSucceeds(runTransaction(caregiverDB, async (transaction) => {
      await transaction.get(inviteForCaregiver);
      await transaction.get(caregiverLink);
      await transaction.get(userProfileReference(caregiverDB, caregiver));
      transaction.set(caregiverLink, pendingFamilyLink(userA, caregiver));
    }));
    await assertSucceeds(runTransaction(ownerDB, async (transaction) => {
      await transaction.get(ownerLink);
      await transaction.get(invitation);
      transaction.update(invitation, { status: 'rejected', updatedAt: serverTimestamp() });
    }));
    expect((await assertSucceeds(getDoc(ownerLink))).data().status).toBe('pending');
    await assertFails(getDoc(medicationReference(caregiverDB, userA)));
    await assertSucceeds(runTransaction(ownerDB, async (transaction) => {
      await transaction.get(ownerLink);
      const inviteSnapshot = await transaction.get(invitation);
      expect(inviteSnapshot.data().status).toBe('rejected');
      transaction.update(ownerLink, { status: 'rejected', revision: 2, updatedAt: serverTimestamp() });
    }));
    expect((await assertSucceeds(getDoc(caregiverLink))).data().status).toBe('rejected');
    await assertFails(getDoc(inviteForCaregiver));
    await assertFails(getDoc(medicationReference(caregiverDB, userA)));
    await assertFails(updateDoc(caregiverLink, { status: 'active', revision: 3, updatedAt: serverTimestamp() }));
  });

  it('denies collection-group link discovery unless query is scoped to the signed-in caregiver UID', async () => {
    await seed('users/' + userA, userProfile(userA));
    await seed('users/' + caregiver, userProfile(caregiver, 'caregiver'));
    await seed('elderlyProfiles/' + userA + '/caregiverLinks/' + caregiver, familyLink(userA, caregiver));
    const caregiverDB = firestoreAs(caregiver);
    const ownLinks = await assertSucceeds(getDocs(query(
      collectionGroup(caregiverDB, 'caregiverLinks'),
      where('caregiverUid', '==', caregiver),
    )));
    expect(ownLinks.size).toBe(1);
    await assertFails(getDocs(collectionGroup(caregiverDB, 'caregiverLinks')));
    await assertFails(getDocs(query(
      collectionGroup(caregiverDB, 'caregiverLinks'),
      where('caregiverUid', '==', userB),
    )));
  });

  it('allows an already-approved link to read only active medicines and schedules', async () => {
    await seed('users/' + userA, userProfile(userA));
    await seed('users/' + userB, userProfile(userB));
    await seed('users/' + caregiver, userProfile(caregiver, 'caregiver'));
    await seed('elderlyProfiles/' + userA + '/medications/medication-a', medication(userA));
    await seed('elderlyProfiles/' + userA + '/medications/medication-inactive', medication(userA, {
      name: 'Thuốc đã ngừng',
      status: 'inactive',
    }));
    await seed('elderlyProfiles/' + userA + '/medicationSchedules/schedule-a', medicationSchedule(userA));
    await seed('elderlyProfiles/' + userA + '/medicationSchedules/schedule-inactive', medicationSchedule(userA, {
      localTime: '09:00',
      active: false,
    }));

    const ownerDB = firestoreAs(userA);
    const caregiverDB = firestoreAs(caregiver);
    const unrelatedDB = firestoreAs(userB);

    await assertFails(getDocs(medicationsCollection(caregiverDB, userA)));
    await assertFails(getDocs(medicationSchedulesCollection(caregiverDB, userA)));
    expect((await assertSucceeds(getDoc(familyLinkRef(caregiverDB)))).exists()).toBe(false);

    await seed('elderlyProfiles/' + userA + '/caregiverLinks/' + caregiver, familyLink(userA, caregiver));
    await assertSucceeds(getDoc(familyLinkRef(caregiverDB)));
    const sharedMedicationDocs = await assertSucceeds(getDocs(query(
      medicationsCollection(caregiverDB, userA),
      where('ownerUid', '==', userA),
      where('status', '==', 'active'),
    )));
    expect(sharedMedicationDocs.size).toBe(1);
    expect(sharedMedicationDocs.docs[0]?.data()).toEqual(
      expect.objectContaining({
        name: 'Paracetamol',
        strengthText: '500 mg',
        directionsText: 'Nội dung do người dùng cung cấp',
        status: 'active',
      }),
    );
    const sharedScheduleDocs = await assertSucceeds(getDocs(query(
      medicationSchedulesCollection(caregiverDB, userA),
      where('ownerUid', '==', userA),
      where('active', '==', true),
    )));
    expect(sharedScheduleDocs.size).toBe(1);
    await assertSucceeds(getDoc(medicationReference(caregiverDB, userA)));
    await assertSucceeds(getDoc(medicationScheduleReference(caregiverDB, userA)));
    await assertFails(getDoc(medicationReference(caregiverDB, userA, 'medication-inactive')));
    await assertFails(getDoc(medicationScheduleReference(caregiverDB, userA, 'schedule-inactive')));
    await assertFails(getDocs(medicationsCollection(caregiverDB, userA)));
    await assertFails(getDocs(medicationSchedulesCollection(caregiverDB, userA)));

    await assertFails(getDoc(familyLinkRef(unrelatedDB)));
    await assertFails(getDocs(medicationsCollection(unrelatedDB, userA)));
    await assertFails(getDocs(medicationSchedulesCollection(unrelatedDB, userA)));
    await assertFails(getDocs(medicationsCollection(caregiverDB, userB)));
    await assertFails(getDocs(collection(caregiverDB, 'users')));
    await assertFails(getDocs(collection(caregiverDB, 'elderlyProfiles', userA, 'caregiverLinks')));
    await assertFails(updateDoc(medicationReference(caregiverDB, userA), { name: 'Not mine', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(medicationScheduleReference(caregiverDB, userA), { active: false, updatedAt: serverTimestamp() }));
    await assertFails(getDocs(doseEventsCollection(caregiverDB, userA)));
  });

  it('streams owner schedule edits and delivers a live revoke event before health listeners stop', async () => {
    await seed('users/' + userA, userProfile(userA));
    await seed('users/' + caregiver, userProfile(caregiver, 'caregiver'));
    await seed('elderlyProfiles/' + userA + '/medications/medication-a', medication(userA));
    await seed('elderlyProfiles/' + userA + '/medicationSchedules/schedule-a', medicationSchedule(userA));
    const ownerDB = firestoreAs(userA);
    const caregiverDB = firestoreAs(caregiver);
    const link = familyLinkRef(ownerDB);
    const caregiverLink = familyLinkRef(caregiverDB);
    const scheduleQuery = query(
      medicationSchedulesCollection(caregiverDB, userA),
      where('ownerUid', '==', userA),
      where('active', '==', true),
    );

    await seed('elderlyProfiles/' + userA + '/caregiverLinks/' + caregiver, familyLink(userA, caregiver));
    const observedTimes = new Set();
    const timeWaiters = new Map();
    let scheduleListenerError = null;
    const stopSchedule = onSnapshot(scheduleQuery, { includeMetadataChanges: true }, (snapshot) => {
      if (snapshot.metadata.fromCache || snapshot.size !== 1) return;
      const time = snapshot.docs[0].data().localTime;
      observedTimes.add(time);
      const pending = timeWaiters.get(time);
      if (pending) {
        timeWaiters.delete(time);
        pending.resolve();
      }
    }, (error) => {
      scheduleListenerError = error;
      for (const pending of timeWaiters.values()) pending.reject(error);
      timeWaiters.clear();
    });

    const observedLinkStatuses = new Set();
    const linkWaiters = new Map();
    let linkListenerError = null;
    let scheduleListenerStoppedByRevoke = false;
    const stopLink = onSnapshot(caregiverLink, { includeMetadataChanges: true }, (snapshot) => {
      if (snapshot.metadata.fromCache || !snapshot.exists()) return;
      const status = snapshot.data().status;
      observedLinkStatuses.add(status);
      const pending = linkWaiters.get(status);
      if (pending) {
        linkWaiters.delete(status);
        pending.resolve();
      }
      if (status === 'revoked' && !scheduleListenerStoppedByRevoke) {
        stopSchedule();
        scheduleListenerStoppedByRevoke = true;
      }
    }, (error) => {
      linkListenerError = error;
      for (const pending of linkWaiters.values()) pending.reject(error);
      linkWaiters.clear();
    });

    const waitForTime = (time) => {
      if (observedTimes.has(time)) return Promise.resolve();
      if (scheduleListenerError) return Promise.reject(scheduleListenerError);
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          timeWaiters.delete(time);
          reject(new Error('Timed out awaiting caregiver Firestore schedule: ' + time));
        }, 8000);
        timeWaiters.set(time, {
          resolve: () => { clearTimeout(timeout); resolve(); },
          reject: (error) => { clearTimeout(timeout); reject(error); },
        });
      });
    };
    const waitForLinkStatus = (status) => {
      if (observedLinkStatuses.has(status)) return Promise.resolve();
      if (linkListenerError) return Promise.reject(linkListenerError);
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          linkWaiters.delete(status);
          reject(new Error('Timed out awaiting caregiver link status: ' + status));
        }, 8000);
        linkWaiters.set(status, {
          resolve: () => { clearTimeout(timeout); resolve(); },
          reject: (error) => { clearTimeout(timeout); reject(error); },
        });
      });
    };

    try {
      await waitForLinkStatus('active');
      await waitForTime('08:00');
      await assertSucceeds(updateDoc(medicationScheduleReference(ownerDB, userA), {
        localTime: '09:45',
        revision: 2,
        updatedAt: serverTimestamp(),
      }));
      await waitForTime('09:45');
      await assertSucceeds(updateDoc(link, {
        status: 'revoked', revision: 2, updatedAt: serverTimestamp(),
      }));
      await waitForLinkStatus('revoked');
      expect(scheduleListenerStoppedByRevoke).toBe(true);
    } finally {
      stopLink();
      stopSchedule();
      for (const pending of timeWaiters.values()) {
        pending.reject(new Error('Caregiver schedule listener stopped'));
      }
      for (const pending of linkWaiters.values()) {
        pending.reject(new Error('Caregiver link listener stopped'));
      }
      timeWaiters.clear();
      linkWaiters.clear();
    }

    const revokedLink = await assertSucceeds(getDoc(caregiverLink));
    expect(revokedLink.data().status).toBe('revoked');
    await assertFails(getDoc(medicationScheduleReference(caregiverDB, userA)));
    await assertFails(getDocs(scheduleQuery));
    await assertFails(getDocs(query(
      medicationsCollection(caregiverDB, userA),
      where('ownerUid', '==', userA),
      where('status', '==', 'active'),
    )));
    // The owner retains their own plan after removing caregiver permissions.
    const ownerSchedule = await assertSucceeds(getDoc(medicationScheduleReference(ownerDB, userA)));
    expect(ownerSchedule.data().localTime).toBe('09:45');
  });

  it('revokes caregiver access and disallows reactivation or owner deletion', async () => {
    await seed('users/' + userA, userProfile(userA));
    await seed('users/' + caregiver, userProfile(caregiver, 'caregiver'));
    await seed('elderlyProfiles/' + userA + '/medications/medication-a', medication(userA));
    await seed('elderlyProfiles/' + userA + '/medicationSchedules/schedule-a', medicationSchedule(userA));
    const ownerDB = firestoreAs(userA), caregiverDB = firestoreAs(caregiver);
    const ref = familyLinkRef(ownerDB);
    await seed('elderlyProfiles/' + userA + '/caregiverLinks/' + caregiver, familyLink(userA, caregiver));
    await assertSucceeds(updateDoc(ref, {
      status: 'revoked', revision: 2, updatedAt: serverTimestamp(),
    }));
    const revokedLink = await assertSucceeds(getDoc(familyLinkRef(caregiverDB)));
    expect(revokedLink.data().status).toBe('revoked');
    await assertFails(getDocs(medicationsCollection(caregiverDB, userA)));
    await assertFails(getDocs(medicationSchedulesCollection(caregiverDB, userA)));
    await assertFails(updateDoc(ref, {
      status: 'active', revision: 3, updatedAt: serverTimestamp(),
    }));
    await assertFails(deleteDoc(ref));
    await assertFails(setDoc(ref, familyLink(userA, caregiver)));
  });

  it('denies malformed direct gets and documents full-document list-query behavior', async () => {
    await seed('users/' + userA, userProfile(userA));
    await seed('users/' + caregiver, userProfile(caregiver, 'caregiver'));
    const ownerDB = firestoreAs(userA);
    const caregiverDB = firestoreAs(caregiver);
    await seed('elderlyProfiles/' + userA + '/caregiverLinks/' + caregiver, familyLink(userA, caregiver));

    // These documents are deliberately seeded outside Rules to model legacy,
    // imported, or administrator-written records that bypass client writes.
    await seed('elderlyProfiles/' + userA + '/medications/misfiled', medication(userB));
    await seed('elderlyProfiles/' + userA + '/medications/extra-field', medication(userA, {
      internalNote: 'must not be shared through a malformed document',
    }));
    await seed('elderlyProfiles/' + userA + '/medicationSchedules/misfiled', medicationSchedule(userB));
    await seed('elderlyProfiles/' + userA + '/medicationSchedules/extra-field', medicationSchedule(userA, {
      internalNote: 'must not be shared through a malformed document',
    }));

    await assertFails(getDoc(medicationReference(caregiverDB, userA, 'misfiled')));
    await assertFails(getDoc(medicationReference(caregiverDB, userA, 'extra-field')));
    await assertFails(getDoc(medicationScheduleReference(caregiverDB, userA, 'misfiled')));
    await assertFails(getDoc(medicationScheduleReference(caregiverDB, userA, 'extra-field')));

    // Firestore list rules can constrain owner/status but cannot project
    // individual fields. The extra-field row is transferred in full; the
    // caregiver client must fail closed and the owner must review the scope.
    const listedMedications = await assertSucceeds(getDocs(query(
      medicationsCollection(caregiverDB, userA),
      where('ownerUid', '==', userA),
      where('status', '==', 'active'),
    )));
    expect(listedMedications.docs.map((snapshot) => snapshot.id).sort()).toEqual(['extra-field']);
    const listedSchedules = await assertSucceeds(getDocs(query(
      medicationSchedulesCollection(caregiverDB, userA),
      where('ownerUid', '==', userA),
      where('active', '==', true),
    )));
    expect(listedSchedules.docs.map((snapshot) => snapshot.id).sort()).toEqual(['extra-field']);
  });

  it('denies caregiver self-approval, spoofed target roles and extra privilege fields', async () => {
    await seed('users/' + userA, userProfile(userA));
    await seed('users/' + userB, userProfile(userB));
    await seed('users/' + caregiver, userProfile(caregiver, 'caregiver'));
    const ownerDB = firestoreAs(userA), caregiverDB = firestoreAs(caregiver);

    await assertFails(setDoc(familyLinkRef(caregiverDB), familyLink(userA, caregiver)));
    await assertFails(setDoc(familyLinkRef(ownerDB, userA, userB), familyLink(userA, userB)));
    await assertFails(setDoc(familyLinkRef(ownerDB), familyLink(userA, caregiver)));
    const bad = [
      familyLink(userA, caregiver, { ownerUid: userB }),
      familyLink(userA, caregiver, { caregiverUid: userB }),
      familyLink(userA, caregiver, { status: 'revoked' }),
      familyLink(userA, caregiver, { revision: 5 }),
      familyLink(userA, caregiver, { scopes: { medicationsRead: true, schedulesRead: true, doseHistoryRead: true } }),
      familyLink(userA, caregiver, { scopes: { medicationsRead: true, schedulesRead: false } }),
      familyLink(userA, caregiver, { privilege: 'admin' }),
      familyLink(userA, caregiver, { createdAt: new Date('2020-01-01T00:00:00Z') }),
    ];
    for (const data of bad) {
      await assertFails(setDoc(familyLinkRef(ownerDB), data));
    }
  });

});

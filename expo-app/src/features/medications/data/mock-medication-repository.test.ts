import { MedicationValidationError } from '../domain/medication-validation';
import type { MedicationInput } from '../domain/medication-repository';

import { MockMedicationRepository } from './mock-medication-repository';

const validInput: MedicationInput = {
  name: '  Vitamin D3  ',
  strengthText: ' 1.000 IU ',
  directionsText: ' Nội dung do người dùng cung cấp ',
};

function createRepository(seedDemoMedications = false) {
  let tick = 0;
  return new MockMedicationRepository({
    now: () => new Date(Date.UTC(2026, 10, 18, 0, 0, tick++)),
    seedDemoMedications,
  });
}

describe('MockMedicationRepository', () => {
  it('creates a valid medication with trimmed user-provided text and an active initial status', async () => {
    const repository = createRepository();

    const medication = await repository.createMedication('elderly-a', validInput);

    expect(medication).toMatchObject({
      name: 'Vitamin D3',
      strengthText: '1.000 IU',
      directionsText: 'Nội dung do người dùng cung cấp',
      status: 'active',
    });
    await expect(repository.listMedications('elderly-a')).resolves.toEqual([medication]);
  });

  it('rejects an empty medication name and overlong user-entered fields', async () => {
    const repository = createRepository();

    await expect(
      repository.createMedication('elderly-a', { name: '   ', strengthText: '', directionsText: '' }),
    ).rejects.toBeInstanceOf(MedicationValidationError);
    await expect(
      repository.createMedication('elderly-a', { name: 'a'.repeat(121), strengthText: '', directionsText: '' }),
    ).rejects.toBeInstanceOf(MedicationValidationError);
    await expect(
      repository.createMedication('elderly-a', { name: 'Vitamin', strengthText: 'x'.repeat(81), directionsText: '' }),
    ).rejects.toBeInstanceOf(MedicationValidationError);
    await expect(
      repository.createMedication('elderly-a', { name: 'Vitamin', strengthText: '', directionsText: 'x'.repeat(501) }),
    ).rejects.toBeInstanceOf(MedicationValidationError);
  });

  it('updates an existing medication in place rather than creating a duplicate', async () => {
    const repository = createRepository();
    const created = await repository.createMedication('elderly-a', validInput);

    const updated = await repository.updateMedication('elderly-a', created.id, {
      name: 'Vitamin D3 mới',
      strengthText: '',
      directionsText: 'Nội dung đã chỉnh sửa',
    });

    expect(updated).toMatchObject({
      id: created.id,
      name: 'Vitamin D3 mới',
      strengthText: '',
      directionsText: 'Nội dung đã chỉnh sửa',
      status: 'active',
    });
    await expect(repository.listMedications('elderly-a')).resolves.toEqual([updated]);
  });

  it('marks a medication inactive without deleting its mock record', async () => {
    const repository = createRepository();
    const created = await repository.createMedication('elderly-a', validInput);

    const inactive = await repository.markMedicationInactive('elderly-a', created.id);

    expect(inactive).toMatchObject({ id: created.id, status: 'inactive' });
    await expect(repository.listMedications('elderly-a', { status: 'active' })).resolves.toEqual([]);
    await expect(repository.listMedications('elderly-a', { status: 'inactive' })).resolves.toEqual([inactive]);
    await expect(repository.getMedicationById('elderly-a', created.id)).resolves.toEqual(inactive);
  });

  it('returns a distinct empty result when a medication does not exist', async () => {
    const repository = createRepository();

    await expect(repository.getMedicationById('elderly-a', 'missing-medication')).resolves.toBeNull();
    await expect(
      repository.updateMedication('elderly-a', 'missing-medication', validInput),
    ).rejects.toThrow('Không tìm thấy thuốc');
  });

  it('partitions mock records by user and never resolves another user’s record', async () => {
    const repository = createRepository();
    const medicationForA = await repository.createMedication('elderly-a', validInput);

    await expect(repository.listMedications('elderly-b')).resolves.toEqual([]);
    await expect(repository.getMedicationById('elderly-b', medicationForA.id)).resolves.toBeNull();
    await expect(
      repository.markMedicationInactive('elderly-b', medicationForA.id),
    ).rejects.toThrow('Không tìm thấy thuốc');
    await expect(repository.getMedicationById('elderly-a', medicationForA.id)).resolves.toEqual(medicationForA);
  });

  it('keeps the seeded schedule medication IDs available independently for every demo account', async () => {
    const repository = createRepository(true);

    const medicationsForA = await repository.getActiveMedications('elderly-a');
    const medicationsForB = await repository.getActiveMedications('elderly-b');

    expect(medicationsForA.map((medication) => medication.id)).toEqual([
      'med-metformin-500',
      'med-amlodipine-5',
    ]);
    expect(medicationsForB.map((medication) => ({ id: medication.id, status: medication.status }))).toEqual(
      medicationsForA.map((medication) => ({ id: medication.id, status: medication.status })),
    );

    await repository.markMedicationInactive('elderly-a', 'med-metformin-500');
    await expect(repository.getActiveMedications('elderly-b')).resolves.toEqual(medicationsForB);
  });
});

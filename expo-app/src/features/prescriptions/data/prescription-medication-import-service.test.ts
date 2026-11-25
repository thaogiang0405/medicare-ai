import type { MedicationRepository } from '@/features/medications';
import type { Medication } from '@/types/domain';

import { PrescriptionMedicationImportService } from './prescription-medication-import-service';

function medication(id: string, name: string): Medication {
  return {
    id,
    name,
    strengthText: '500 mg',
    directionsText: 'Theo đơn đã xác nhận',
    status: 'active',
    createdAt: '2026-11-20T00:00:00.000Z',
    updatedAt: '2026-11-20T00:00:00.000Z',
  };
}

function repository(overrides: Partial<MedicationRepository> = {}): MedicationRepository {
  return {
    listMedications: jest.fn(async () => []),
    getActiveMedications: jest.fn(async () => []),
    getMedicationById: jest.fn(async () => null),
    createMedication: jest.fn(async (_uid, input) => medication('created', input.name)),
    updateMedication: jest.fn(async (_uid, id, input) => medication(id, input.name)),
    markMedicationInactive: jest.fn(async (uid, id) => medication(`${uid}-${id}`, 'Inactive')),
    ...overrides,
  };
}

describe('PrescriptionMedicationImportService', () => {
  it('saves reviewed candidates once and reports duplicates without changing existing records', async () => {
    const createMedication = jest.fn(async (_uid: string, input) => medication('created', input.name));
    const service = new PrescriptionMedicationImportService(repository({ createMedication }));

    const result = await service.importConfirmedCandidates({
      confirmed: true,
      userId: 'elderly-a',
      candidates: [
        { id: 'first', selected: true, input: { name: 'Metformin', strengthText: '500 mg', directionsText: 'Sau ăn' } },
        { id: 'duplicate', selected: true, input: { name: ' metformin ', strengthText: '500 mg', directionsText: 'Sau ăn' } },
        { id: 'not-selected', selected: false, input: { name: 'Amlodipine', strengthText: '5 mg', directionsText: '' } },
      ],
    });

    expect(createMedication).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ savedCount: 1, duplicateCount: 1, failedCount: 0 });
    expect(result.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ candidateId: 'first', status: 'saved' }),
      expect.objectContaining({ candidateId: 'duplicate', status: 'skippedDuplicate' }),
    ]));
  });

  it('returns per-item failures so a retry cannot accidentally repeat a successful item', async () => {
    const createMedication = jest.fn(async (_uid: string, input) => {
      if (input.name === 'Không lưu được') {
        throw new Error('Mất kết nối');
      }
      return medication('created', input.name);
    });
    const service = new PrescriptionMedicationImportService(repository({ createMedication }));

    const result = await service.importConfirmedCandidates({
      confirmed: true,
      userId: 'elderly-a',
      candidates: [
        { id: 'saved', selected: true, input: { name: 'Đã lưu', strengthText: '', directionsText: '' } },
        { id: 'failed', selected: true, input: { name: 'Không lưu được', strengthText: '', directionsText: '' } },
      ],
    });

    expect(result).toMatchObject({ savedCount: 1, failedCount: 1 });
    expect(result.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ candidateId: 'saved', status: 'saved' }),
      expect.objectContaining({ candidateId: 'failed', status: 'failed', message: 'Mất kết nối' }),
    ]));
  });

  it('stops remaining writes after a session change', async () => {
    let isCurrent = true;
    const createMedication = jest.fn(async () => {
      isCurrent = false;
      return medication('created', 'Thuốc đầu');
    });
    const service = new PrescriptionMedicationImportService(repository({ createMedication }));

    const result = await service.importConfirmedCandidates({
      confirmed: true,
      userId: 'elderly-a',
      isCurrentSession: () => isCurrent,
      candidates: [
        { id: 'first', selected: true, input: { name: 'Thuốc đầu', strengthText: '', directionsText: '' } },
        { id: 'second', selected: true, input: { name: 'Thuốc sau', strengthText: '', directionsText: '' } },
      ],
    });

    expect(createMedication).toHaveBeenCalledTimes(1);
    expect(result.failedCount).toBe(2);
  });
});

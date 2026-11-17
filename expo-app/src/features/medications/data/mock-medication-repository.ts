import type { Medication } from '@/types/domain';

import type { MedicationRepository } from '../domain/medication-repository';

const medications: readonly Medication[] = [
  {
    id: 'med-metformin-500',
    name: 'Metformin',
    strengthText: '500 mg',
    directionsText: 'Uống sau bữa sáng',
    status: 'active',
  },
  {
    id: 'med-amlodipine-5',
    name: 'Amlodipine',
    strengthText: '5 mg',
    directionsText: 'Uống buổi tối',
    status: 'active',
  },
];

function cloneMedication(medication: Medication): Medication {
  return { ...medication };
}

/** Mock data only; it is not connected to Firestore in Migration 1. */
export class MockMedicationRepository implements MedicationRepository {
  async getActiveMedications(_userId: string): Promise<Medication[]> {
    return medications
      .filter((medication) => medication.status === 'active')
      .map(cloneMedication);
  }

  async getMedicationById(medicationId: string): Promise<Medication | null> {
    const medication = medications.find((item) => item.id === medicationId);
    return medication ? cloneMedication(medication) : null;
  }
}

export const mockMedicationRepository = new MockMedicationRepository();

import type { DoseEvent, Medication } from '@/types/domain';

import { resolveMedicationForDose } from './elderly-dashboard-utils';

const doseEvent: DoseEvent = {
  id: 'dose-metformin-morning',
  medicationId: 'med-metformin-500',
  scheduledAt: '2026-11-18T01:00:00.000Z',
  status: 'pending',
};

const medication: Medication = {
  id: 'med-metformin-500',
  name: 'Metformin',
  strengthText: '500 mg',
  directionsText: 'Uống sau bữa sáng',
  status: 'inactive',
  createdAt: '2026-11-18T00:00:00.000Z',
  updatedAt: '2026-11-18T00:00:00.000Z',
};

describe('resolveMedicationForDose', () => {
  it('keeps the demo schedule display safe when a medication is inactive or missing', () => {
    expect(resolveMedicationForDose(doseEvent, [medication])).toEqual(medication);
    expect(resolveMedicationForDose(doseEvent, [])).toBeNull();
  });
});

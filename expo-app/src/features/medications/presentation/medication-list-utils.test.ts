import type { Medication } from '@/types/domain';

import { filterVisibleMedications } from './medication-list-utils';

const medications: Medication[] = [
  {
    id: 'med-active',
    name: 'Metformin',
    strengthText: '500 mg',
    directionsText: '',
    status: 'active',
    createdAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z',
  },
  {
    id: 'med-inactive',
    name: 'Amlodipine',
    strengthText: '5 mg',
    directionsText: '',
    status: 'inactive',
    createdAt: '2026-11-18T00:00:00.000Z',
    updatedAt: '2026-11-18T00:00:00.000Z',
  },
];

describe('filterVisibleMedications', () => {
  it('filters by a textual status choice without relying on color', () => {
    expect(filterVisibleMedications(medications, 'active', '')).toEqual([medications[0]]);
    expect(filterVisibleMedications(medications, 'inactive', '')).toEqual([medications[1]]);
    expect(filterVisibleMedications(medications, 'all', '')).toEqual(medications);
  });

  it('trims and applies a case-insensitive name search within the selected status', () => {
    expect(filterVisibleMedications(medications, 'all', '  metFORmin ')).toEqual([medications[0]]);
    expect(filterVisibleMedications(medications, 'inactive', 'metformin')).toEqual([]);
  });
});

import type { Medication } from '@/types/domain';

import {
  assertValidMedicationInput,
} from '../domain/medication-validation';
import type {
  MedicationInput,
  MedicationListOptions,
  MedicationRepository,
} from '../domain/medication-repository';

function cloneMedication(medication: Medication): Medication {
  return { ...medication };
}

function assertUserId(userId: string): string {
  const normalizedUserId = userId.trim();

  if (!normalizedUserId) {
    throw new Error('Không thể xác định tài khoản hiện tại. Vui lòng đăng nhập lại.');
  }

  return normalizedUserId;
}

function demoMedications(now: () => Date): Medication[] {
  const timestamp = now().toISOString();

  return [
    {
      id: 'med-metformin-500',
      name: 'Metformin',
      strengthText: '500 mg',
      directionsText: 'Uống sau bữa sáng',
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: 'med-amlodipine-5',
      name: 'Amlodipine',
      strengthText: '5 mg',
      directionsText: 'Uống buổi tối',
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
}

export type MockMedicationRepositoryOptions = Readonly<{
  now?: () => Date;
  seedDemoMedications?: boolean;
}>;

/**
 * Mutable in-memory data source for Migration 3.1. Records are partitioned by
 * the authenticated session's UID; that is demo isolation, not production
 * authorization. It never reads or writes Firebase/AsyncStorage.
 */
export class MockMedicationRepository implements MedicationRepository {
  private readonly medicationsByUserId = new Map<string, Medication[]>();
  private readonly now: () => Date;
  private readonly seedDemoMedications: boolean;
  private nextGeneratedId = 0;

  constructor({ now = () => new Date(), seedDemoMedications = true }: MockMedicationRepositoryOptions = {}) {
    this.now = now;
    this.seedDemoMedications = seedDemoMedications;
  }

  private getUserMedications(userId: string): Medication[] {
    const safeUserId = assertUserId(userId);
    const existing = this.medicationsByUserId.get(safeUserId);

    if (existing) {
      return existing;
    }

    const initial = this.seedDemoMedications ? demoMedications(this.now).map(cloneMedication) : [];
    this.medicationsByUserId.set(safeUserId, initial);
    return initial;
  }

  async listMedications(userId: string, { status = 'all' }: MedicationListOptions = {}): Promise<Medication[]> {
    return this.getUserMedications(userId)
      .filter((medication) => status === 'all' || medication.status === status)
      .map(cloneMedication);
  }

  async getActiveMedications(_userId: string): Promise<Medication[]> {
    return this.listMedications(_userId, { status: 'active' });
  }

  async getMedicationById(userId: string, medicationId: string): Promise<Medication | null> {
    const medication = this.getUserMedications(userId).find((item) => item.id === medicationId);
    return medication ? cloneMedication(medication) : null;
  }

  async createMedication(userId: string, input: MedicationInput): Promise<Medication> {
    const normalized = assertValidMedicationInput(input);
    const records = this.getUserMedications(userId);
    const timestamp = this.now().toISOString();
    this.nextGeneratedId += 1;
    const medication: Medication = {
      id: `med-demo-${this.nextGeneratedId}`,
      ...normalized,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    records.unshift(medication);
    return cloneMedication(medication);
  }

  async updateMedication(userId: string, medicationId: string, input: MedicationInput): Promise<Medication> {
    const normalized = assertValidMedicationInput(input);
    const records = this.getUserMedications(userId);
    const medicationIndex = records.findIndex((item) => item.id === medicationId);

    if (medicationIndex < 0) {
      throw new Error('Không tìm thấy thuốc cần chỉnh sửa.');
    }

    const updatedMedication: Medication = {
      ...records[medicationIndex],
      ...normalized,
      updatedAt: this.now().toISOString(),
    };
    records[medicationIndex] = updatedMedication;
    return cloneMedication(updatedMedication);
  }

  async markMedicationInactive(userId: string, medicationId: string): Promise<Medication> {
    const records = this.getUserMedications(userId);
    const medicationIndex = records.findIndex((item) => item.id === medicationId);

    if (medicationIndex < 0) {
      throw new Error('Không tìm thấy thuốc cần ngừng sử dụng.');
    }

    const currentMedication = records[medicationIndex];
    const updatedMedication: Medication = {
      ...currentMedication,
      status: 'inactive',
      updatedAt: currentMedication.status === 'inactive' ? currentMedication.updatedAt : this.now().toISOString(),
    };
    records[medicationIndex] = updatedMedication;
    return cloneMedication(updatedMedication);
  }
}

export const mockMedicationRepository = new MockMedicationRepository();

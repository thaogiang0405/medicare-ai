export type { MedicationRepository } from './domain/medication-repository';
export {
  medicationFieldLimits,
  type MedicationInput,
  type MedicationListOptions,
  type MedicationListStatus,
} from './domain/medication-repository';
export {
  MedicationValidationError,
  assertValidMedicationInput,
  normalizeMedicationInput,
  validateMedicationInput,
  type MedicationInputErrors,
} from './domain/medication-validation';
export {
  FirestoreMedicationRepository,
  MedicationRepositoryError,
  getFirestoreMedicationRepository,
  mapFirestoreMedicationDocument,
  mapMedicationRepositoryError,
  type FirestoreMedicationDocument,
  type FirestoreMedicationPort,
} from './data/firestore-medication-repository';
export {
  getMedicationRepository,
  selectMedicationRepository,
} from './data/medication-repository-selector';
export {
  MockMedicationRepository,
  mockMedicationRepository,
} from './data/mock-medication-repository';

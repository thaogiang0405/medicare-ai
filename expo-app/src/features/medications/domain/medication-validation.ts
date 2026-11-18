import { medicationFieldLimits, type MedicationInput } from './medication-repository';

export type MedicationInputErrors = Partial<Record<keyof MedicationInput, string>>;

export class MedicationValidationError extends Error {
  constructor(readonly fieldErrors: MedicationInputErrors) {
    super('Thông tin thuốc chưa hợp lệ.');
    this.name = 'MedicationValidationError';
  }
}

/** Preserves user-provided wording while removing accidental outer whitespace. */
export function normalizeMedicationInput(input: MedicationInput): MedicationInput {
  return {
    name: input.name.trim(),
    strengthText: input.strengthText.trim(),
    directionsText: input.directionsText.trim(),
  };
}

export function validateMedicationInput(input: MedicationInput): MedicationInputErrors {
  const normalized = normalizeMedicationInput(input);
  const errors: MedicationInputErrors = {};

  if (!normalized.name) {
    errors.name = 'Vui lòng nhập tên thuốc.';
  } else if (normalized.name.length > medicationFieldLimits.name) {
    errors.name = `Tên thuốc không quá ${medicationFieldLimits.name} ký tự.`;
  }

  if (normalized.strengthText.length > medicationFieldLimits.strengthText) {
    errors.strengthText = `Hàm lượng hoặc quy cách không quá ${medicationFieldLimits.strengthText} ký tự.`;
  }

  if (normalized.directionsText.length > medicationFieldLimits.directionsText) {
    errors.directionsText = `Hướng dẫn sử dụng không quá ${medicationFieldLimits.directionsText} ký tự.`;
  }

  return errors;
}

export function assertValidMedicationInput(input: MedicationInput): MedicationInput {
  const normalized = normalizeMedicationInput(input);
  const errors = validateMedicationInput(normalized);

  if (Object.keys(errors).length > 0) {
    throw new MedicationValidationError(errors);
  }

  return normalized;
}

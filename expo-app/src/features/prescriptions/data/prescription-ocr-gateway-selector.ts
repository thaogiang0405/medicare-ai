import type { PrescriptionOcrGateway } from '../domain/prescription-ocr';
import { getFirebasePrescriptionOcrGateway } from './firebase-prescription-ocr-gateway';
import { isPrescriptionOcrFeatureEnabled, prescriptionOcrUnavailableMessage } from './prescription-ocr-feature';
import { PrescriptionOcrError } from './prescription-ocr-errors';

/** The disabled path has no synthetic result and keeps manual entry available. */
class DisabledPrescriptionOcrGateway implements PrescriptionOcrGateway {
  async recognizePrescription(): Promise<never> {
    throw new PrescriptionOcrError('feature-disabled', prescriptionOcrUnavailableMessage);
  }
}

const disabledPrescriptionOcrGateway = new DisabledPrescriptionOcrGateway();

export function selectPrescriptionOcrGateway(
  enabled: boolean,
  getFirebaseGateway: () => PrescriptionOcrGateway = getFirebasePrescriptionOcrGateway,
): PrescriptionOcrGateway {
  return enabled ? getFirebaseGateway() : disabledPrescriptionOcrGateway;
}

export function getPrescriptionOcrGateway(): PrescriptionOcrGateway {
  return selectPrescriptionOcrGateway(isPrescriptionOcrFeatureEnabled());
}

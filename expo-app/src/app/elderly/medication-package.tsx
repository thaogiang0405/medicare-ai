import PrescriptionOcrScreen from '@/features/prescriptions/presentation/PrescriptionOcrScreen';

/** Reuses the existing offline OCR worker and review-first import workflow. */
export default function MedicationPackageScreen() {
  return <PrescriptionOcrScreen scanMode="packaging" />;
}

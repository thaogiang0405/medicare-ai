import type { MedicationRepository } from '@/features/medications';
import type { Medication } from '@/types/domain';

import type { PrescriptionOcrGateway, PrescriptionOcrImagePage, PrescriptionOcrResult } from './domain/prescription-ocr';
import { createPrescriptionOcrStore } from './prescription-ocr-store';

const imagePage: PrescriptionOcrImagePage = {
  id: 'page-a',
  uri: 'file:///temporary-a.jpg',
  mimeType: 'image/jpeg',
  byteSize: 3,
  width: 100,
  height: 100,
  base64: 'YWJj',
  qualityWarnings: [],
};

const ocrResult: PrescriptionOcrResult = {
  provider: 'google-cloud-vision',
  pages: [{ pageIndex: 0, text: '1. Paracetamol 500 mg - Uống khi cần', confidence: null, qualityWarnings: [] }],
};

function repository(): MedicationRepository {
  const item = (id: string, name: string): Medication => ({
    id,
    name,
    strengthText: '',
    directionsText: '',
    status: 'active',
    createdAt: '2026-11-20T00:00:00.000Z',
    updatedAt: '2026-11-20T00:00:00.000Z',
  });
  return {
    listMedications: jest.fn(async () => []),
    getActiveMedications: jest.fn(async () => []),
    getMedicationById: jest.fn(async () => null),
    createMedication: jest.fn(async (_uid, input) => item('created', input.name)),
    updateMedication: jest.fn(async (_uid, id, input) => item(id, input.name)),
    markMedicationInactive: jest.fn(async (_uid, id) => item(id, 'inactive')),
  };
}

describe('prescription OCR store', () => {
  it('drops a late OCR response after an account switch', async () => {
    let resolveOcr: ((value: PrescriptionOcrResult) => void) | undefined;
    const pendingOcr = new Promise<PrescriptionOcrResult>((resolve) => {
      resolveOcr = resolve;
    });
    const gateway: PrescriptionOcrGateway = { recognizePrescription: jest.fn(async () => pendingOcr) };
    const store = createPrescriptionOcrStore(gateway, repository, () => true);

    store.getState().bindAuthenticatedUser('elderly-a');
    store.getState().setPages([imagePage]);
    store.getState().setConsentAccepted(true);
    const processing = store.getState().requestOcr();

    store.getState().bindAuthenticatedUser('elderly-b');
    resolveOcr?.(ocrResult);
    await processing;

    expect(store.getState()).toMatchObject({
      activeUserId: 'elderly-b',
      pages: [],
      ocrResult: null,
      candidates: [],
      status: 'ready',
    });
  });

  it('keeps cloud OCR disabled until an explicit feature flag opt-in', async () => {
    const gateway: PrescriptionOcrGateway = { recognizePrescription: jest.fn(async () => ocrResult) };
    const store = createPrescriptionOcrStore(gateway, repository, () => false);

    store.getState().bindAuthenticatedUser('elderly-a');
    store.getState().setPages([imagePage]);
    store.getState().setConsentAccepted(true);
    await store.getState().process();

    expect(gateway.recognizePrescription).not.toHaveBeenCalled();
    expect(store.getState()).toMatchObject({
      status: 'error',
      errorMessage: expect.stringContaining('chưa được bật'),
    });
  });

  it('clears temporary image, OCR text, and review candidates on cancellation/logout reset', async () => {
    const gateway: PrescriptionOcrGateway = { recognizePrescription: jest.fn(async () => ocrResult) };
    const store = createPrescriptionOcrStore(gateway, repository, () => true);

    store.getState().bindAuthenticatedUser('elderly-a');
    store.getState().setPages([imagePage]);
    store.getState().setConsentAccepted(true);
    await store.getState().process();
    expect(store.getState().candidates).toHaveLength(1);

    store.getState().cancel();
    expect(store.getState()).toMatchObject({ pages: [], ocrResult: null, candidates: [], consentAccepted: false });

    store.getState().setPages([imagePage]);
    store.getState().reset();
    expect(store.getState()).toMatchObject({ activeUserId: null, pages: [], ocrResult: null, candidates: [] });
  });
});

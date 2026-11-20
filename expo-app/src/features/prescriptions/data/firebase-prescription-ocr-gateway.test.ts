/* eslint-disable import/first */

jest.mock('firebase/functions', () => ({
  getFunctions: jest.fn(),
  httpsCallable: jest.fn(),
}));

import type { PrescriptionOcrRequest } from '../domain/prescription-ocr';
import {
  FirebasePrescriptionOcrGateway,
  mapPrescriptionOcrCallableResponse,
  type FirebasePrescriptionOcrPort,
} from './firebase-prescription-ocr-gateway';

const request: PrescriptionOcrRequest = {
  consentAccepted: true,
  pages: [{
    id: 'page-a',
    uri: 'file:///temporary-a.jpg',
    mimeType: 'image/jpeg',
    byteSize: 3,
    width: 100,
    height: 100,
    base64: 'YWJj',
    qualityWarnings: [],
  }],
};

function port(overrides: Partial<FirebasePrescriptionOcrPort> = {}): FirebasePrescriptionOcrPort {
  return {
    getCurrentAuthUser: () => ({ uid: 'elderly-a' }),
    invokeCallable: async () => ({
      provider: 'google-cloud-vision',
      pages: [{ pageIndex: 0, text: '1. Paracetamol 500 mg', confidence: null, qualityWarnings: [] }],
    }),
    ...overrides,
  };
}

describe('FirebasePrescriptionOcrGateway', () => {
  it('sends image bytes without a UI UID and maps a typed callable response', async () => {
    const invokeCallable = jest.fn(port().invokeCallable);
    const gateway = new FirebasePrescriptionOcrGateway(port({ invokeCallable }));

    await expect(gateway.recognizePrescription('elderly-a', request)).resolves.toEqual({
      provider: 'google-cloud-vision',
      pages: [{ pageIndex: 0, text: '1. Paracetamol 500 mg', confidence: null, qualityWarnings: [] }],
    });
    expect(invokeCallable).toHaveBeenCalledWith({
      consentAccepted: true,
      pages: [{ pageIndex: 0, mimeType: 'image/jpeg', base64: 'YWJj', byteSize: 3 }],
    });
  });

  it('rejects a stale response after the Firebase Auth user changes', async () => {
    let authReads = 0;
    const gateway = new FirebasePrescriptionOcrGateway(port({
      getCurrentAuthUser: () => ({ uid: authReads++ === 0 ? 'elderly-a' : 'elderly-b' }),
    }));

    await expect(gateway.recognizePrescription('elderly-a', request)).rejects.toThrow(
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    );
  });

  it('does not accept a demo or malformed callable response as real OCR', () => {
    expect(() => mapPrescriptionOcrCallableResponse({ provider: 'demo', pages: [] })).toThrow(
      'nguồn dữ liệu không hợp lệ',
    );
    expect(() => mapPrescriptionOcrCallableResponse({ provider: 'google-cloud-vision', pages: [] })).toThrow(
      'dữ liệu không hợp lệ',
    );
  });
});

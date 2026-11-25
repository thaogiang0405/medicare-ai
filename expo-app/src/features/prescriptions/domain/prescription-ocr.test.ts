import {
  prescriptionOcrMaximumPageBytes,
  prescriptionOcrMaximumPages,
  validatePrescriptionOcrRequest,
  type PrescriptionOcrImagePage,
} from './prescription-ocr';

function page(id: string, overrides: Partial<PrescriptionOcrImagePage> = {}): PrescriptionOcrImagePage {
  return {
    id,
    uri: `file:///temporary-${id}.jpg`,
    mimeType: 'image/jpeg',
    byteSize: 3,
    width: 100,
    height: 100,
    base64: 'YWJj',
    qualityWarnings: [],
    ...overrides,
  };
}

describe('prescription OCR request validation', () => {
  it('preserves a user-selected order of up to three prepared pages', () => {
    const request = validatePrescriptionOcrRequest({
      consentAccepted: true,
      pages: [page('second'), page('first')],
    });

    expect(request.pages.map((item) => item.id)).toEqual(['second', 'first']);
  });

  it('requires explicit acknowledgement and enforces page/image limits before local processing', () => {
    expect(() => validatePrescriptionOcrRequest({ consentAccepted: false as never, pages: [page('a')] })).toThrow(
      'Vui lòng xác nhận xử lý',
    );
    expect(() => validatePrescriptionOcrRequest({
      consentAccepted: true,
      pages: Array.from({ length: prescriptionOcrMaximumPages + 1 }, (_, index) => page(`page-${index}`)),
    })).toThrow('1 đến 3');
    expect(() => validatePrescriptionOcrRequest({
      consentAccepted: true,
      pages: [page('oversized', { byteSize: prescriptionOcrMaximumPageBytes + 1 })],
    })).toThrow('quá lớn');
  });

  it('rejects data URI and invalid image payloads rather than uploading them', () => {
    expect(() => validatePrescriptionOcrRequest({
      consentAccepted: true,
      pages: [page('bad-base64', { base64: 'data:image/jpeg;base64,YWJj' })],
    })).toThrow('Dữ liệu ảnh');
  });
});

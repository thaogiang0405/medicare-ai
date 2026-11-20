import { HttpsError } from 'firebase-functions/v2/https';

import { MAX_OCR_PAGES } from '../src/ocr/contracts';
import { validateOcrPayload } from '../src/ocr/validation';

function page(pageIndex: number) {
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, pageIndex]);
  return {
    pageIndex,
    mimeType: 'image/png',
    base64: bytes.toString('base64'),
    byteSize: bytes.length,
  };
}

function getHttpsCode(error: unknown): string {
  expect(error).toBeInstanceOf(HttpsError);
  return (error as HttpsError).code;
}

describe('validateOcrPayload', () => {
  it('sorts valid multi-page input by explicit page index', () => {
    const request = validateOcrPayload({
      consentAccepted: true,
      pages: [page(2), page(0), page(1)],
    });

    expect(request.pages.map((item) => item.pageIndex)).toEqual([0, 1, 2]);
  });

  it('rejects duplicate page order and mismatched client byte size', () => {
    expect(() =>
      validateOcrPayload({ consentAccepted: true, pages: [page(0), page(0)] }),
    ).toThrow();

    expect(() =>
      validateOcrPayload({
        consentAccepted: true,
        pages: [{ ...page(0), byteSize: 1 }],
      }),
    ).toThrow();
  });

  it('rejects more than the server page limit before processing image bytes', () => {
    const pages = Array.from({ length: MAX_OCR_PAGES + 1 }, (_, index) => page(index));
    expect(() => validateOcrPayload({ consentAccepted: true, pages })).toThrow();
  });

  it('rejects invalid image payloads with safe callable errors', () => {
    try {
      validateOcrPayload({
        consentAccepted: true,
        pages: [{ ...page(0), base64: 'not-base64!!' }],
      });
      fail('Expected validation to throw');
    } catch (error) {
      expect(getHttpsCode(error)).toBe('invalid-argument');
    }
  });

  it('rejects bytes that do not match their declared MIME type', () => {
    expect(() =>
      validateOcrPayload({
        consentAccepted: true,
        pages: [{ ...page(0), mimeType: 'image/jpeg' }],
      }),
    ).toThrow();
  });
});

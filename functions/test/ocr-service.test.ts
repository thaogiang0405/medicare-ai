import {
  MAX_OCR_PAGE_TEXT_CHARS,
  OcrDependencies,
  OcrPageResult,
  OcrProvider,
  ValidatedOcrPage,
} from '../src/ocr/contracts';
import {
  OcrProviderQuotaError,
  OcrProviderUnavailableError,
  OcrRateLimitError,
} from '../src/ocr/errors';
import { InMemoryOcrRateLimiter } from '../src/ocr/rate-limiter';
import { processPrescriptionOcrRequest } from '../src/ocr/service';

const elderlyProfile = {
  uid: 'elderly-1',
  primaryRole: 'elderly',
  roles: { elderly: true, caregiver: false },
  onboardingCompleted: true,
};

function page(pageIndex: number) {
  const bytes = Buffer.from([0xff, 0xd8, 0xff, pageIndex]);
  return {
    pageIndex,
    mimeType: 'image/jpeg',
    base64: bytes.toString('base64'),
    byteSize: bytes.length,
  } as const;
}

class TestProvider implements OcrProvider {
  public readonly received: ValidatedOcrPage[] = [];

  public async documentTextDetection(input: ValidatedOcrPage): Promise<OcrPageResult> {
    this.received.push(input);
    return {
      pageIndex: input.pageIndex,
      text: `VĂN BẢN MÔ PHỎNG TRANG ${input.pageIndex}`,
      confidence: 0.91,
      qualityWarnings: [],
    };
  }
}

function dependencies(provider: OcrProvider = new TestProvider()): OcrDependencies {
  return {
    profiles: { get: jest.fn(async () => elderlyProfile) },
    rateLimiter: new InMemoryOcrRateLimiter(),
    provider,
    now: () => new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('processPrescriptionOcrRequest', () => {
  it('accepts an eligible elderly user and processes pages in explicit page order', async () => {
    const provider = new TestProvider();
    const result = await processPrescriptionOcrRequest(
      {
        auth: { uid: 'elderly-1' },
        data: { consentAccepted: true, pages: [page(1), page(0)] },
      },
      dependencies(provider),
    );

    expect(result.provider).toBe('google-cloud-vision');
    expect(result.pages.map((item) => item.pageIndex)).toEqual([0, 1]);
    expect(provider.received.map((item) => item.pageIndex)).toEqual([0, 1]);
  });

  it('requires Firebase Authentication', async () => {
    await expect(
      processPrescriptionOcrRequest(
        { auth: null, data: { consentAccepted: true, pages: [page(0)] } },
        dependencies(),
      ),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('requires a canonical, onboarded elderly profile instead of a UI role', async () => {
    const denied = dependencies();
    denied.profiles = {
      get: async () => ({
        ...elderlyProfile,
        primaryRole: 'caregiver',
        roles: { elderly: false, caregiver: true },
      }),
    };

    await expect(
      processPrescriptionOcrRequest(
        { auth: { uid: 'elderly-1' }, data: { consentAccepted: true, pages: [page(0)] } },
        denied,
      ),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('requires explicit cloud-processing consent before provider invocation', async () => {
    const provider = new TestProvider();
    await expect(
      processPrescriptionOcrRequest(
        { auth: { uid: 'elderly-1' }, data: { consentAccepted: false, pages: [page(0)] } },
        dependencies(provider),
      ),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(provider.received).toHaveLength(0);
  });

  it('returns an honest unavailable error for the OCR provider without leaking its failure', async () => {
    const unavailableProvider: OcrProvider = {
      documentTextDetection: async () => {
        throw new OcrProviderUnavailableError();
      },
    };

    await expect(
      processPrescriptionOcrRequest(
        { auth: { uid: 'elderly-1' }, data: { consentAccepted: true, pages: [page(0)] } },
        dependencies(unavailableProvider),
      ),
    ).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('maps an exhausted server rate limit to resource-exhausted', async () => {
    const limited = dependencies();
    limited.rateLimiter = {
      consume: async () => {
        throw new OcrRateLimitError();
      },
    };

    await expect(
      processPrescriptionOcrRequest(
        { auth: { uid: 'elderly-1' }, data: { consentAccepted: true, pages: [page(0)] } },
        limited,
      ),
    ).rejects.toMatchObject({ code: 'resource-exhausted' });
  });

  it('maps a bounded provider quota failure to resource-exhausted', async () => {
    const quotaProvider: OcrProvider = {
      documentTextDetection: async () => {
        throw new OcrProviderQuotaError();
      },
    };

    await expect(
      processPrescriptionOcrRequest(
        { auth: { uid: 'elderly-1' }, data: { consentAccepted: true, pages: [page(0)] } },
        dependencies(quotaProvider),
      ),
    ).rejects.toMatchObject({ code: 'resource-exhausted' });
  });

  it('caps an oversized provider response and binds it to the requested page', async () => {
    const overflowingProvider: OcrProvider = {
      documentTextDetection: async () => ({
        pageIndex: 999,
        text: 'x'.repeat(MAX_OCR_PAGE_TEXT_CHARS + 10),
        confidence: 2,
        qualityWarnings: ['UPSTREAM_WARNING'],
      }),
    };

    const result = await processPrescriptionOcrRequest(
      { auth: { uid: 'elderly-1' }, data: { consentAccepted: true, pages: [page(0)] } },
      dependencies(overflowingProvider),
    );

    expect(result.pages[0]).toMatchObject({
      pageIndex: 0,
      confidence: null,
      qualityWarnings: expect.arrayContaining(['OCR_TEXT_TRUNCATED']),
    });
    expect(result.pages[0]?.text).toHaveLength(MAX_OCR_PAGE_TEXT_CHARS);
  });
});

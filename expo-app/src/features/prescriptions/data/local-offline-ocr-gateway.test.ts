import {
  getLocalOfflineOcrAssetUrls,
  hasOnlyRelativeLocalOfflineOcrAssetPaths,
} from './local-offline-ocr-assets';
import {
  LocalOfflineOcrGateway,
} from './local-offline-ocr-gateway';
import { PrescriptionOcrError } from './prescription-ocr-errors';
import type {
  LocalOfflineOcrPageResult,
  LocalOfflineOcrPort,
} from './local-offline-ocr-bridge';
import type { PrescriptionOcrRequest } from '../domain/prescription-ocr';

const request: PrescriptionOcrRequest = {
  consentAccepted: true,
  pages: [
    {
      id: 'page-a',
      uri: 'file:///temporary-a.jpg',
      mimeType: 'image/jpeg',
      byteSize: 3,
      width: 100,
      height: 100,
      base64: 'YWJj',
      qualityWarnings: [],
    },
    {
      id: 'page-b',
      uri: 'file:///temporary-b.jpg',
      mimeType: 'image/jpeg',
      byteSize: 3,
      width: 100,
      height: 100,
      base64: 'ZGVm',
      qualityWarnings: [],
    },
  ],
};

const recognizedPage = (text: string, confidence = 0.91): LocalOfflineOcrPageResult => ({
  text,
  confidence,
  qualityWarnings: [],
});

function port(overrides: Partial<LocalOfflineOcrPort> = {}): LocalOfflineOcrPort {
  return {
    isReady: () => true,
    recognizePage: async (page) => recognizedPage(`Thuốc trang ${page.pageIndex + 1}`),
    cancelActivePage: jest.fn(),
    ...overrides,
  };
}

describe('LocalOfflineOcrGateway', () => {
  it('uses a ready local port sequentially and never passes a source URI into the DOM bridge', async () => {
    const recognizePage = jest.fn(async (page) => recognizedPage(`Đơn thuốc ${page.pageIndex + 1}`));
    const gateway = new LocalOfflineOcrGateway(() => port({ recognizePage }), () => 'elderly-a');
    const progress: string[] = [];

    const result = await gateway.recognizePrescription('elderly-a', request, {
      onProgress: (event) => progress.push(`${event.pageIndex}:${event.phase}`),
    });

    expect(result).toEqual({
      provider: 'local-offline',
      pages: [
        { pageIndex: 0, text: 'Đơn thuốc 1', confidence: 0.91, qualityWarnings: [] },
        { pageIndex: 1, text: 'Đơn thuốc 2', confidence: 0.91, qualityWarnings: [] },
      ],
    });
    expect(recognizePage).toHaveBeenCalledTimes(2);
    expect(recognizePage.mock.calls[0]?.[0]).toEqual({
      id: 'page-a', pageIndex: 0, mimeType: 'image/jpeg', base64: 'YWJj',
      width: 100, height: 100, sourceMode: 'prescription',
    });
    expect(recognizePage.mock.calls[0]?.[0]).not.toHaveProperty('uri');
    expect(progress).toContain('0:preparing');
    expect(progress).toContain('1:preparing');
  });


  it('forwards packaging mode and image dimensions to the local worker without image URI', async () => {
    const recognizePage = jest.fn(async (_page: Parameters<LocalOfflineOcrPort['recognizePage']>[0]) => recognizedPage('Paracetamol 500 mg'));
    const gateway = new LocalOfflineOcrGateway(() => port({ recognizePage }), () => 'elderly-a');
    const result = await gateway.recognizePrescription(
      'elderly-a', { ...request, pages: [request.pages[0]!] },
      { sourceMode: 'packaging' },
    );

    expect(result.provider).toBe('local-offline');
    expect(recognizePage).toHaveBeenCalledTimes(1);
    expect(recognizePage.mock.calls[0]?.[0]).toEqual({
      id: 'page-a', pageIndex: 0, mimeType: 'image/jpeg',
      base64: 'YWJj', width: 100, height: 100, sourceMode: 'packaging',
    });
    expect(recognizePage.mock.calls[0]?.[0]).not.toHaveProperty('uri');
  });

  it('does not process with a stale Firebase Auth UID', async () => {
    let currentUserId = 'elderly-a';
    const gateway = new LocalOfflineOcrGateway(
      () => port({ recognizePage: async () => {
        currentUserId = 'elderly-b';
        return recognizedPage('Paracetamol 500 mg');
      } }),
      () => currentUserId,
    );

    await expect(gateway.recognizePrescription('elderly-a', { ...request, pages: [request.pages[0]!] }))
      .rejects.toMatchObject({ code: 'unauthenticated' });
  });

  it('aborts an active local page without waiting for a stale result', async () => {
    const recognizePage = jest.fn((_page, options: Parameters<LocalOfflineOcrPort['recognizePage']>[1]) => new Promise<LocalOfflineOcrPageResult>((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new PrescriptionOcrError('cancelled', 'cancelled')), { once: true });
    }));
    const gateway = new LocalOfflineOcrGateway(() => port({ recognizePage }), () => 'elderly-a');
    const controller = new AbortController();

    const pending = gateway.recognizePrescription('elderly-a', { ...request, pages: [request.pages[0]!] }, { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('fails safely when the local engine host has not initialized', async () => {
    const gateway = new LocalOfflineOcrGateway(() => port({ isReady: () => false }), () => 'elderly-a');

    await expect(gateway.recognizePrescription('elderly-a', { ...request, pages: [request.pages[0]!] }))
      .rejects.toMatchObject({ code: 'unavailable' });
  });
});

describe('local offline OCR asset configuration', () => {
  it('only builds app-local vendor paths rather than a third-party CDN URL', () => {
    const urls = getLocalOfflineOcrAssetUrls('/assets/');

    expect(hasOnlyRelativeLocalOfflineOcrAssetPaths()).toBe(true);
    expect(Object.values(urls)).toEqual([
      '/assets/ocr/tesseract/tesseract.min.js',
      '/assets/ocr/tesseract/worker.min.js',
      '/assets/ocr/tesseract-core',
      '/assets/ocr/lang',
    ]);
    expect(Object.values(urls).some((value) => /^https?:\/\//i.test(value))).toBe(false);
  });
});

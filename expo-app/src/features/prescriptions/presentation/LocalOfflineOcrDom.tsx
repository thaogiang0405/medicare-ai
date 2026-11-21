'use dom';

import { useEffect, useRef, useState } from 'react';
import type { DOMProps } from 'expo/dom';

import { getLocalOfflineOcrAssetUrls } from '../data/local-offline-ocr-assets';
import { toLocalOfflineOcrPageResult } from '../data/local-offline-ocr-result';
import { getPackageLabelRegion, prioritizePrintedPackageLabel } from '../data/medication-package-ocr-focus';
import type {
  LocalOfflineOcrPageInput,
  LocalOfflineOcrPageProgress,
  LocalOfflineOcrPageResult,
} from '../data/local-offline-ocr-bridge';

type TesseractLoggerEvent = Readonly<{
  status?: unknown;
  progress?: unknown;
}>;

type TesseractWorker = Readonly<{
  recognize(image: string, options?: Readonly<{ rectangle?: Readonly<{ left: number; top: number; width: number; height: number }> }>): Promise<Readonly<{ data: Readonly<{ text: unknown; confidence: unknown }> }>>;
  setParameters(params: Readonly<{ tessedit_pageseg_mode: '6' | '11' }>): Promise<unknown>;
  terminate(): Promise<unknown>;
}>;

type TesseractRuntime = Readonly<{
  createWorker(
    languages: readonly string[],
    oem: number,
    options: Readonly<{
      workerPath: string;
      corePath: string;
      langPath: string;
      cacheMethod: 'none';
      workerBlobURL: false;
      gzip: true;
      logger: (event: TesseractLoggerEvent) => void;
    }>,
  ): Promise<TesseractWorker>;
}>;

declare global {
  interface Window {
    Tesseract?: TesseractRuntime;
  }
}

export type LocalOfflineOcrDomJob = Readonly<{
  id: string;
  page: LocalOfflineOcrPageInput;
}>;

export type LocalOfflineOcrDomProps = Readonly<{
  job: LocalOfflineOcrDomJob | null;
  onEngineReady: () => Promise<void>;
  onEngineError: () => Promise<void>;
  onProgress: (event: Readonly<{ jobId: string; progress: LocalOfflineOcrPageProgress }>) => Promise<void>;
  onResult: (event: Readonly<{ jobId: string; result: LocalOfflineOcrPageResult }>) => Promise<void>;
  onCancelled: (event: Readonly<{ jobId: string }>) => Promise<void>;
  onError: (event: Readonly<{ jobId: string }>) => Promise<void>;
  dom?: DOMProps;
}>;

let loadRuntimePromise: Promise<TesseractRuntime> | null = null;

function readPublicBaseUrl(): string {
  return process.env.EXPO_BASE_URL ?? '';
}

function localOfflineOcrDomAssetUrls(baseUrl = readPublicBaseUrl()) {
  return getLocalOfflineOcrAssetUrls(baseUrl);
}

function loadRuntime(): Promise<TesseractRuntime> {
  if (window.Tesseract) {
    return Promise.resolve(window.Tesseract);
  }

  if (loadRuntimePromise) {
    return loadRuntimePromise;
  }

  const runtimePromise = new Promise<TesseractRuntime>((resolve, reject) => {
    const urls = localOfflineOcrDomAssetUrls();
    let existing = document.querySelector<HTMLScriptElement>('script[data-medicare-local-ocr="true"]');
    if (existing) {
      if (existing.dataset.medicareLocalOcrState === 'loaded' || existing.dataset.medicareLocalOcrState === 'error') {
        existing.remove();
        existing = null;
      }
    }
    if (existing) {
      existing.addEventListener('load', () => {
        existing.dataset.medicareLocalOcrState = 'loaded';
        if (window.Tesseract) {
          resolve(window.Tesseract);
        } else {
          existing.remove();
          reject(new Error('runtime unavailable'));
        }
      }, { once: true });
      existing.addEventListener('error', () => {
        existing.dataset.medicareLocalOcrState = 'error';
        reject(new Error('runtime unavailable'));
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.dataset.medicareLocalOcr = 'true';
    script.src = urls.script;
    script.onload = () => {
      script.dataset.medicareLocalOcrState = 'loaded';
      if (window.Tesseract) {
        resolve(window.Tesseract);
      } else {
        script.remove();
        reject(new Error('runtime unavailable'));
      }
    };
    script.onerror = () => {
      script.dataset.medicareLocalOcrState = 'error';
      reject(new Error('runtime unavailable'));
    };
    document.head.appendChild(script);
  });

  loadRuntimePromise = runtimePromise;
  void runtimePromise.catch(() => {
    if (loadRuntimePromise === runtimePromise) {
      loadRuntimePromise = null;
    }
  });
  return runtimePromise;
}

function phaseForLoggerEvent(event: TesseractLoggerEvent): LocalOfflineOcrPageProgress {
  const status = typeof event.status === 'string' ? event.status.toLowerCase() : '';
  const rawProgress = typeof event.progress === 'number' && Number.isFinite(event.progress)
    ? Math.max(0, Math.min(1, event.progress))
    : null;

  if (status.includes('language')) {
    return { phase: 'loading-language', progress: rawProgress };
  }
  if (status.includes('recogniz')) {
    return { phase: 'recognizing', progress: rawProgress };
  }
  if (status.includes('core') || status.includes('initializ')) {
    return { phase: 'loading-engine', progress: rawProgress };
  }
  return { phase: 'preparing', progress: rawProgress };
}

function toImageDataUri(page: LocalOfflineOcrPageInput): string {
  return `data:${page.mimeType};base64,${page.base64}`;
}

/** Expo DOM callback promises may reject during navigation/unmount. Don't leak
 * unhandled bridge rejections into Expo Go's error overlay. */
async function safelyNotify(callback: () => Promise<void>): Promise<boolean> {
  try {
    await callback();
    return true;
  } catch {
    return false;
  }
}

async function terminateWorker(worker: TesseractWorker | null): Promise<void> {
  if (!worker) return;
  try {
    await worker.terminate();
  } catch {
    // Termination is best-effort; do not emit raw worker errors or image data.
  }
}

/**
 * A fully local Tesseract.js WebView runtime. Tesseract is loaded only in this
 * DOM context, never in React Native/Hermes. All script, worker, WASM, and
 * language-model paths resolve from Expo's vendored public assets.
 */
export default function LocalOfflineOcrDom({
  job,
  onEngineReady,
  onEngineError,
  onProgress,
  onResult,
  onCancelled,
  onError,
}: LocalOfflineOcrDomProps) {
  const [engineState, setEngineState] = useState<'loading' | 'ready' | 'error'>('loading');
  const activeWorkerRef = useRef<TesseractWorker | null>(null);
  const activeJobIdRef = useRef<string | null>(null);

  useEffect(() => {
    let disposed = false;

    const prewarm = async () => {
      let worker: TesseractWorker | null = null;
      try {
        const runtime = await loadRuntime();
        const urls = localOfflineOcrDomAssetUrls();
        worker = await runtime.createWorker(['vie', 'eng'], 1, {
          workerPath: urls.worker,
          corePath: urls.coreDirectory,
          langPath: urls.languageDirectory,
          cacheMethod: 'none',
          workerBlobURL: false,
          gzip: true,
          logger: () => undefined,
        });
        await terminateWorker(worker);
        worker = null;
        if (disposed) return;
        setEngineState('ready');
        await safelyNotify(onEngineReady);
      } catch {
        await terminateWorker(worker);
        if (disposed) return;
        setEngineState('error');
        await safelyNotify(onEngineError);
      }
    };

    void prewarm().catch(() => undefined);
    return () => {
      disposed = true;
      void terminateWorker(activeWorkerRef.current);
      activeWorkerRef.current = null;
      activeJobIdRef.current = null;
    };
  }, [onEngineError, onEngineReady]);

  useEffect(() => {
    if (!job || engineState !== 'ready') return;

    let cancelled = false;
    let worker: TesseractWorker | null = null;
    activeJobIdRef.current = job.id;

    const recognize = async () => {
      try {
        const runtime = await loadRuntime();
        if (cancelled) return;
        const urls = localOfflineOcrDomAssetUrls();
        worker = await runtime.createWorker(['vie', 'eng'], 1, {
          workerPath: urls.worker,
          corePath: urls.coreDirectory,
          langPath: urls.languageDirectory,
          cacheMethod: 'none',
          workerBlobURL: false,
          gzip: true,
          logger: (event) => {
            if (!cancelled && activeJobIdRef.current === job.id) {
              void safelyNotify(() => onProgress({ jobId: job.id, progress: phaseForLoggerEvent(event) }));
            }
          },
        });
        activeWorkerRef.current = worker;
        if (cancelled || activeJobIdRef.current !== job.id) return;

        const imageData = toImageDataUri(job.page);
        // Packaging differs from prescriptions: names can be much larger than
        // the small printed instructions in the same photograph.
        if (job.page.sourceMode === 'packaging') {
          await worker.setParameters({ tessedit_pageseg_mode: '11' });
        }
        const result = await worker.recognize(imageData);
        if (cancelled || activeJobIdRef.current !== job.id) {
          await safelyNotify(() => onCancelled({ jobId: job.id }));
          return;
        }

        let text = typeof result.data.text === 'string' ? result.data.text : '';
        let usedFocusedPass = false;
        if (job.page.sourceMode === 'packaging') {
          const region = getPackageLabelRegion(job.page.width, job.page.height);
          if (region && !cancelled && activeJobIdRef.current === job.id) {
            // A single bounded additional pass; if WebView runs out of memory
            // or segmentation fails, keep the full-frame OCR result.
            try {
              await worker.setParameters({ tessedit_pageseg_mode: '6' });
              const focused = await worker.recognize(imageData, { rectangle: region });
              const prioritized = prioritizePrintedPackageLabel(
                text,
                typeof focused.data.text === 'string' ? focused.data.text : '',
              );
              text = prioritized.text;
              usedFocusedPass = prioritized.usedFocusedPass;
            } catch {
              // Best effort only. Do not log private photo/text or invent names.
            }
          }
        }

        if (cancelled || activeJobIdRef.current !== job.id) {
          await safelyNotify(() => onCancelled({ jobId: job.id }));
          return;
        }

        const normalized = toLocalOfflineOcrPageResult({ text, confidence: result.data.confidence });
        const pageResult = usedFocusedPass ? {
          ...normalized,
          qualityWarnings: [
            ...normalized.qualityWarnings,
            'Đã đọc bổ sung vùng nhãn in. Vui lòng đối chiếu tên và hàm lượng với bao bì thật.',
          ],
        } : normalized;

        await safelyNotify(() => onProgress({ jobId: job.id, progress: { phase: 'finalizing', progress: 1 } }));
        const delivered = await safelyNotify(() => onResult({ jobId: job.id, result: pageResult }));
        if (!delivered) {
          await safelyNotify(() => onError({ jobId: job.id }));
        }
      } catch {
        if (cancelled || activeJobIdRef.current !== job.id) {
          await safelyNotify(() => onCancelled({ jobId: job.id }));
          return;
        }
        await safelyNotify(() => onError({ jobId: job.id }));
      } finally {
        await terminateWorker(worker);
        if (activeWorkerRef.current === worker) activeWorkerRef.current = null;
        if (activeJobIdRef.current === job.id) activeJobIdRef.current = null;
      }
    };

    void recognize().catch(() => undefined);
    return () => {
      cancelled = true;
      if (activeJobIdRef.current === job.id) {
        void terminateWorker(activeWorkerRef.current);
        activeWorkerRef.current = null;
        activeJobIdRef.current = null;
      }
    };
  }, [engineState, job, onCancelled, onError, onProgress, onResult]);

  return <div aria-live="polite" style={{ fontFamily: 'system-ui', fontSize: 12, padding: 4 }}>
    {engineState === 'loading' ? 'Đang chuẩn bị OCR cục bộ…' : engineState === 'ready' ? 'OCR cục bộ đã sẵn sàng.' : 'OCR cục bộ chưa sẵn sàng.'}
  </div>;
}

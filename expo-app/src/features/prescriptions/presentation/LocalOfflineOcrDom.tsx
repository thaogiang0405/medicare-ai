'use dom';

import { useEffect, useRef, useState } from 'react';
import type { DOMProps } from 'expo/dom';

import { getLocalOfflineOcrAssetUrls } from '../data/local-offline-ocr-assets';
import { toLocalOfflineOcrPageResult } from '../data/local-offline-ocr-result';
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
  recognize(image: string): Promise<Readonly<{ data: Readonly<{ text: unknown; confidence: unknown }> }>>;
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
        await onEngineReady();
      } catch {
        await terminateWorker(worker);
        if (disposed) return;
        setEngineState('error');
        await onEngineError();
      }
    };

    void prewarm();
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
              void onProgress({ jobId: job.id, progress: phaseForLoggerEvent(event) });
            }
          },
        });
        activeWorkerRef.current = worker;
        if (cancelled || activeJobIdRef.current !== job.id) return;

        const result = await worker.recognize(toImageDataUri(job.page));
        if (cancelled || activeJobIdRef.current !== job.id) {
          await onCancelled({ jobId: job.id });
          return;
        }

        await onProgress({ jobId: job.id, progress: { phase: 'finalizing', progress: 1 } });
        await onResult({ jobId: job.id, result: toLocalOfflineOcrPageResult(result.data) });
      } catch {
        if (cancelled || activeJobIdRef.current !== job.id) {
          await onCancelled({ jobId: job.id });
          return;
        }
        await onError({ jobId: job.id });
      } finally {
        await terminateWorker(worker);
        if (activeWorkerRef.current === worker) activeWorkerRef.current = null;
        if (activeJobIdRef.current === job.id) activeJobIdRef.current = null;
      }
    };

    void recognize();
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

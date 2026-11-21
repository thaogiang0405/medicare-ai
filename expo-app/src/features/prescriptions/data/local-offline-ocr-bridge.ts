import type {
  PrescriptionOcrImagePage,
  PrescriptionOcrProgressPhase,
} from '../domain/prescription-ocr';

/** Data passed through the DOM bridge contains one transient image page only. */
export type LocalOfflineOcrPageInput = Readonly<Pick<
  PrescriptionOcrImagePage,
  'id' | 'mimeType' | 'base64'
> & {
  pageIndex: number;
}>;

export type LocalOfflineOcrPageResult = Readonly<{
  text: string;
  confidence: number | null;
  qualityWarnings: readonly string[];
}>;

export type LocalOfflineOcrPageProgress = Readonly<{
  phase: PrescriptionOcrProgressPhase;
  progress: number | null;
}>;

export type LocalOfflineOcrPort = Readonly<{
  /** True only after the DOM runtime has initialized a local worker/model. */
  isReady(): boolean;
  recognizePage(
    page: LocalOfflineOcrPageInput,
    options: Readonly<{
      signal?: AbortSignal;
      onProgress?: (progress: LocalOfflineOcrPageProgress) => void;
    }>,
  ): Promise<LocalOfflineOcrPageResult>;
  cancelActivePage(): void;
}>;

let registeredPort: LocalOfflineOcrPort | null = null;

/**
 * The visual DOM host is the only place that can install this port. Keeping
 * the registry tiny prevents the data/store layers from importing WebView or
 * Tesseract into Hermes.
 */
export function registerLocalOfflineOcrPort(port: LocalOfflineOcrPort): () => void {
  registeredPort = port;

  return () => {
    if (registeredPort === port) {
      registeredPort = null;
    }
  };
}

export function getLocalOfflineOcrPort(): LocalOfflineOcrPort | null {
  return registeredPort;
}

/** Test-only cleanup; never exposes image/text data. */
export function resetLocalOfflineOcrPortForTests(): void {
  registeredPort?.cancelActivePage();
  registeredPort = null;
}

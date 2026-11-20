export const OCR_REGION = 'asia-east1';
export const MAX_OCR_PAGES = 3;
export const MAX_OCR_PAGE_BYTES = 5 * 1024 * 1024;
export const MAX_OCR_TOTAL_BYTES = 10 * 1024 * 1024;
/** Bounds callable response size even if an upstream provider returns noise. */
export const MAX_OCR_PAGE_TEXT_CHARS = 12_000;
export const MAX_OCR_TOTAL_TEXT_CHARS = 30_000;
export const OCR_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const OCR_RATE_LIMIT_MAX_REQUESTS = 5;

export const supportedOcrMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type SupportedOcrMimeType = (typeof supportedOcrMimeTypes)[number];

export interface OcrPageInput {
  pageIndex: number;
  mimeType: SupportedOcrMimeType;
  /** Base64 only; data-URI prefixes are deliberately rejected. */
  base64: string;
  /** Client-reported byte size. The server re-computes and verifies it. */
  byteSize: number;
}

export interface ValidatedOcrPage {
  pageIndex: number;
  mimeType: SupportedOcrMimeType;
  bytes: Buffer;
}

export interface ValidatedOcrRequest {
  pages: ValidatedOcrPage[];
}

export interface OcrPageResult {
  pageIndex: number;
  text: string;
  confidence: number | null;
  qualityWarnings: string[];
}

export interface OcrCallableResponse {
  provider: 'google-cloud-vision';
  pages: OcrPageResult[];
}

export interface CallableAuthContext {
  uid: string;
}

export interface OcrCallableRequest {
  auth?: CallableAuthContext | null;
  data: unknown;
}

export interface UserProfileReader {
  get(uid: string): Promise<unknown | undefined>;
}

export interface OcrRateLimiter {
  consume(uid: string, now: Date): Promise<void>;
}

export interface OcrProvider {
  documentTextDetection(page: ValidatedOcrPage): Promise<OcrPageResult>;
}

export interface OcrDependencies {
  profiles: UserProfileReader;
  rateLimiter: OcrRateLimiter;
  provider: OcrProvider;
  now?: () => Date;
}

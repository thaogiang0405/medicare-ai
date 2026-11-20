import { HttpsError } from 'firebase-functions/v2/https';

export class OcrRateLimitError extends Error {
  public constructor() {
    super('OCR rate limit exceeded.');
    this.name = 'OcrRateLimitError';
  }
}

export class OcrProviderUnavailableError extends Error {
  public constructor() {
    super('OCR provider unavailable.');
    this.name = 'OcrProviderUnavailableError';
  }
}

export class OcrProviderQuotaError extends Error {
  public constructor() {
    super('OCR provider quota exhausted.');
    this.name = 'OcrProviderQuotaError';
  }
}

export function invalidRequest(message: string): HttpsError {
  return new HttpsError('invalid-argument', message);
}

import { ImageAnnotatorClient } from '@google-cloud/vision';

import { OcrPageResult, OcrProvider, ValidatedOcrPage } from './contracts';
import { OcrProviderQuotaError, OcrProviderUnavailableError } from './errors';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectConfidenceValues(value: unknown, values: number[]): void {
  if (!isRecord(value)) {
    return;
  }

  if (typeof value.confidence === 'number' && Number.isFinite(value.confidence)) {
    values.push(value.confidence);
  }

  for (const property of ['pages', 'blocks', 'paragraphs', 'words', 'symbols']) {
    const children = value[property];
    if (Array.isArray(children)) {
      for (const child of children) {
        collectConfidenceValues(child, values);
      }
    }
  }
}

function calculateConfidence(annotation: unknown): number | null {
  const values: number[] = [];
  collectConfidenceValues(annotation, values);

  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function qualityWarnings(text: string, confidence: number | null): string[] {
  const warnings: string[] = [];

  if (text.trim().length === 0) {
    warnings.push('OCR_TEXT_EMPTY');
  }

  if (confidence !== null && confidence < 0.6) {
    warnings.push('OCR_LOW_CONFIDENCE');
  }

  if (confidence === null) {
    warnings.push('OCR_CONFIDENCE_UNAVAILABLE');
  }

  return warnings;
}

function isProviderQuotaError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  return error.code === 8 || error.code === 'RESOURCE_EXHAUSTED';
}

/**
 * Production OCR provider. Google authentication is supplied exclusively by
 * Application Default Credentials / the deployed Function service identity.
 */
export class GoogleCloudVisionOcrProvider implements OcrProvider {
  public constructor(private readonly client = new ImageAnnotatorClient()) {}

  public async documentTextDetection(page: ValidatedOcrPage): Promise<OcrPageResult> {
    try {
      const [response] = await this.client.documentTextDetection({
        image: { content: page.bytes },
        imageContext: { languageHints: ['vi'] },
      });
      const annotation = response.fullTextAnnotation;
      const text = annotation?.text?.trim() ?? '';
      const confidence = calculateConfidence(annotation);

      return {
        pageIndex: page.pageIndex,
        text,
        confidence,
        qualityWarnings: qualityWarnings(text, confidence),
      };
    } catch (error) {
      // Deliberately do not attach raw image bytes, OCR text, or provider error
      // details to logs or the callable response.
      if (isProviderQuotaError(error)) {
        throw new OcrProviderQuotaError();
      }

      throw new OcrProviderUnavailableError();
    }
  }
}

/**
 * Test-only provider. It is never selected by production wiring and always
 * labels its output as synthetic so it cannot be mistaken for live OCR.
 */
export class SyntheticPrescriptionOcrProvider implements OcrProvider {
  public async documentTextDetection(page: ValidatedOcrPage): Promise<OcrPageResult> {
    return {
      pageIndex: page.pageIndex,
      text: 'DỮ LIỆU MÔ PHỎNG – Paracetamol 500 mg – Uống khi cần theo đơn mẫu.',
      confidence: null,
      qualityWarnings: ['DEMO_SYNTHETIC_PROVIDER'],
    };
  }
}

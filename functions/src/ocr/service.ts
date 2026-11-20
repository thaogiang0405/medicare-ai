import { HttpsError } from 'firebase-functions/v2/https';

import {
  MAX_OCR_PAGE_TEXT_CHARS,
  MAX_OCR_TOTAL_TEXT_CHARS,
  OcrCallableRequest,
  OcrCallableResponse,
  OcrDependencies,
  OcrPageResult,
} from './contracts';
import {
  OcrProviderQuotaError,
  OcrProviderUnavailableError,
  OcrRateLimitError,
} from './errors';
import { assertEligibleElderlyProfile } from './profile';
import { validateOcrPayload } from './validation';

function boundProviderResult(
  result: OcrPageResult,
  expectedPageIndex: number,
  remainingTextCharacters: number,
): OcrPageResult {
  const unboundedText = typeof result.text === 'string' ? result.text : '';
  const permittedLength = Math.max(
    0,
    Math.min(MAX_OCR_PAGE_TEXT_CHARS, remainingTextCharacters),
  );
  const text = unboundedText.slice(0, permittedLength);
  const warnings = Array.isArray(result.qualityWarnings)
    ? result.qualityWarnings.filter((warning): warning is string => typeof warning === 'string').slice(0, 8)
    : [];

  if (text.length < unboundedText.length) {
    warnings.push('OCR_TEXT_TRUNCATED');
  }

  const confidence =
    typeof result.confidence === 'number' &&
    Number.isFinite(result.confidence) &&
    result.confidence >= 0 &&
    result.confidence <= 1
      ? result.confidence
      : null;

  return {
    // Bind the result to the requested page rather than trusting an upstream
    // provider's page index.
    pageIndex: expectedPageIndex,
    text,
    confidence,
    qualityWarnings: [...new Set(warnings)],
  };
}

/**
 * Pure callable workflow used by the Firebase v2 adapter and unit tests.
 * Requests are tied to the authenticated UID at every boundary to prevent a
 * stale response from being authorized as a different person.
 */
export async function processPrescriptionOcrRequest(
  request: OcrCallableRequest,
  dependencies: OcrDependencies,
): Promise<OcrCallableResponse> {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Vui lòng đăng nhập trước khi quét đơn thuốc.');
  }

  let profile: unknown;
  try {
    profile = await dependencies.profiles.get(uid);
  } catch {
    throw new HttpsError('unavailable', 'Không thể kiểm tra quyền quét đơn thuốc. Vui lòng thử lại.');
  }

  assertEligibleElderlyProfile(uid, profile);
  const payload = validateOcrPayload(request.data);

  try {
    await dependencies.rateLimiter.consume(uid, (dependencies.now ?? (() => new Date()))());
  } catch (error) {
    if (error instanceof OcrRateLimitError) {
      throw new HttpsError(
        'resource-exhausted',
        'Bạn đã gửi quá nhiều yêu cầu quét đơn thuốc. Vui lòng thử lại sau vài phút.',
      );
    }

    throw new HttpsError('unavailable', 'Dịch vụ quét đơn thuốc đang tạm thời không khả dụng.');
  }

  const pages: OcrPageResult[] = [];
  let returnedTextCharacters = 0;
  try {
    // Sequential processing intentionally bounds Vision API calls to three and
    // avoids multiplying sensitive in-memory image buffers under load.
    for (const page of payload.pages) {
      const providerResult = await dependencies.provider.documentTextDetection(page);
      const result = boundProviderResult(
        providerResult,
        page.pageIndex,
        MAX_OCR_TOTAL_TEXT_CHARS - returnedTextCharacters,
      );
      returnedTextCharacters += result.text.length;
      pages.push(result);
    }
  } catch (error) {
    if (error instanceof OcrProviderQuotaError) {
      throw new HttpsError(
        'resource-exhausted',
        'Dịch vụ quét đơn thuốc đang quá tải. Vui lòng thử lại sau.',
      );
    }

    if (error instanceof OcrProviderUnavailableError) {
      throw new HttpsError('unavailable', 'Không thể nhận dạng đơn thuốc lúc này. Vui lòng thử lại.');
    }

    throw new HttpsError('internal', 'Không thể hoàn tất quét đơn thuốc. Vui lòng thử lại.');
  }

  return {
    provider: 'google-cloud-vision',
    pages,
  };
}

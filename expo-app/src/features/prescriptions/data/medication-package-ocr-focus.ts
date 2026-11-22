import { parseMedicationPackageOcrPage } from './medication-package-ocr-parser';

/**
 * A conservative second pass for printed package names, not an inference model.
 * Only prioritizes text that the local OCR worker actually read.
 */
const printedStrength = /\b\d{1,5}(?:[.,]\d{1,3})?\s*(?:mg|mcg|µg|g|ml|iu)\b/i;
const labelPrefix = /^(?:tên\s+thuốc|tên\s+sản\s+phẩm|medicine\s+name|product\s+name)\s*[:：-]\s*/i;
const excludedName = /^(?:thuốc\s+kê\s+đơn|hộp|thành\s+phần|hạn\s+sử\s+dụng|số\s+lô|liều\s+dùng|cách\s+dùng|hướng\s+dẫn|nhà\s+sản\s+xuất|đọc\s+kỹ|dùng\s+cho|thuốc\s+giảm|expiry|lot|batch|ingredients)\b/i;

function candidateNameLine(line: string): boolean {
  const value = line.replace(/\s+/g, ' ').trim();
  const match = value.match(printedStrength);
  if (!match || match.index === undefined || match.index < 3) return false;
  const name = value.slice(0, match.index).replace(labelPrefix, '').trim();
  return name.length >= 3
    && name.length <= 70
    && name.split(/\s+/).length <= 6
    && /^[A-Za-zÀ-ỹ]/.test(name)
    && !excludedName.test(name);
}

/**
 * Compare two genuine OCR readings. Only prefer the enhanced pass if it
 * actually reads a plausible printed product name AND unit-bearing strength.
 * Never repair SOO -> 500 or invent a missing unit from a drug catalogue.
 */
export function selectPackageLabelReading(
  originalText: string,
  enhancedText: string,
): Readonly<{ text: string; enhancedSelected: boolean }> {
  const originalHasEvidence = originalText.split(/\r?\n/).some(candidateNameLine);
  const enhancedHasEvidence = enhancedText.split(/\r?\n/).some(candidateNameLine);
  if (enhancedHasEvidence && !originalHasEvidence) {
    return { text: enhancedText, enhancedSelected: true };
  }
  return { text: originalText, enhancedSelected: false };
}

export type PackageLabelRegion = Readonly<{ left: number; top: number; width: number; height: number }>;

/** Center-upper portion where large printed product titles commonly appear. */
export function getPackageLabelRegion(width: number, height: number): PackageLabelRegion | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 200 || height < 200) return null;
  const left = Math.floor(width * 0.04);
  const top = Math.floor(height * 0.12);
  return {
    left,
    top,
    width: Math.max(1, Math.floor(width * 0.92)),
    height: Math.max(1, Math.floor(height * 0.62)),
  };
}

/**
 * Prioritizes clearly strength-bearing lines from the focused OCR pass,
 * preserving the entire full-frame OCR text for user comparison.
 */
export function prioritizePrintedPackageLabel(fullText: string, focusedText: string): Readonly<{
  text: string;
  usedFocusedPass: boolean;
}> {
  const existing = fullText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const seen = new Set(existing.map((line) => line.toLocaleLowerCase()));
  const focusedCandidates = focusedText.split(/\r?\n/)
    .map((line) => line.trim()).filter(candidateNameLine)
    .filter((line) => {
      const key = line.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 2);
  return focusedCandidates.length > 0
    ? { text: [...focusedCandidates, ...existing].join('\n'), usedFocusedPass: true }
    : { text: fullText, usedFocusedPass: false };
}

/** Best-effort retry for common upper-left, two-line front-panel titles. */
export function getPackageTitleRetryRegion(width: number, height: number): PackageLabelRegion | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 200 || height < 200) return null;
  const left = Math.floor(width * 0.08);
  const top = Math.floor(height * 0.24);
  return {
    left,
    top,
    width: Math.floor(width * 0.87) - left,
    height: Math.floor(height * 0.56) - top,
  };
}

/** Evaluate each complete OCR pass independently; never join partial readings. */
export function hasCompletePrintedPackageLabel(text: string): boolean {
  return Boolean(parseMedicationPackageOcrPage({
    pageIndex: 0, text, confidence: null, qualityWarnings: [],
  })[0]?.input.strengthText);
}

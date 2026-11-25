import { medicationFieldLimits, type MedicationInput } from '@/features/medications/domain/medication-repository';

import type { PrescriptionOcrCandidate, PrescriptionOcrPage } from '../domain/prescription-ocr';

type MutableCandidate = {
  id: string;
  pageIndex: number;
  input: MedicationInput;
  sourceText: string;
  sourceReference: string;
  warnings: string[];
};

const strengthPattern = /\b\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|g|ml|mL|iu|IU|đv|%|units?)\b/i;
const candidatePrefixPattern = /^\s*(?:(?:thuốc\s*)?\d{1,2}\s*[.)\-:]|[-•*])\s*/i;
const medicationLabelPattern = /^\s*(?:tên\s*)?thuốc\s*(?:số\s*\d+)?\s*[:\-]\s*/i;
const medicationNumberLabelPattern = /^\s*(?:thuốc\s*)?\d{1,2}\s*[:\-]\s*/i;
const directionSignalPattern = /\b(?:uống|bôi|nhỏ|xịt|đặt|tiêm|ngày|lần|sáng|trưa|chiều|tối|trước\s*ăn|sau\s*ăn|khi\s*đau|mỗi|viên|gói|ống|giọt)\b|\bx\s*\d+/i;
const nonMedicationHeadingPattern = /^(?:đơn\s*thuốc|chẩn\s*đoán|họ\s*(?:và\s*)?tên|bệnh\s*nhân|ngày\s*kê|bác\s*sĩ|cơ\s*sở|ghi\s*chú|lời\s*dặn)\b/i;

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function removeMedicationPrefix(value: string): string {
  return value
    .replace(medicationLabelPattern, '')
    .replace(medicationNumberLabelPattern, '')
    .replace(candidatePrefixPattern, '')
    .trim();
}

function looksLikeDirection(value: string): boolean {
  return directionSignalPattern.test(value);
}

function hasExplicitMedicationCue(value: string): boolean {
  const withoutPrefix = removeMedicationPrefix(value);
  return withoutPrefix !== value.trim()
    || strengthPattern.test(value)
    || medicationLabelPattern.test(value)
    || medicationNumberLabelPattern.test(value);
}

function isLikelyMedicationLine(line: string): boolean {
  if (!line || nonMedicationHeadingPattern.test(line) || looksLikeDirection(line) && !hasExplicitMedicationCue(line)) {
    return false;
  }

  return hasExplicitMedicationCue(line);
}

function splitMedicationLine(line: string): MedicationInput {
  const normalized = removeMedicationPrefix(line);
  const strengthMatch = normalized.match(strengthPattern);
  const colonIndex = normalized.search(/\s*[:;]\s*/);
  const strengthText = strengthMatch ? collapseWhitespace(strengthMatch[0]) : '';
  let name = '';
  let directionsText = '';

  if (strengthMatch?.index !== undefined) {
    name = collapseWhitespace(normalized.slice(0, strengthMatch.index).replace(/[,:;\-]+$/, ''));
    directionsText = collapseWhitespace(normalized.slice(strengthMatch.index + strengthMatch[0].length)
      .replace(/^\s*[,:;\-]\s*/, ''));
  } else if (colonIndex >= 0) {
    name = collapseWhitespace(normalized.slice(0, colonIndex));
    const remainder = collapseWhitespace(normalized.slice(colonIndex + 1));
    directionsText = looksLikeDirection(remainder) ? remainder : '';
    if (!directionsText && remainder) {
      // The OCR cannot safely classify the remainder. Preserve it for review,
      // rather than inventing a dosage field.
      directionsText = remainder;
    }
  } else {
    name = collapseWhitespace(normalized);
  }

  // OCR sometimes places the directions before a strength token. In that
  // case retain the whole uncertain text as the source and ask for review
  // instead of manufacturing a medication name.
  if (looksLikeDirection(name)) {
    name = '';
  }

  return { name, strengthText, directionsText };
}

function getCandidateWarnings(input: MedicationInput, pageWarnings: readonly string[]): string[] {
  const warnings = new Set<string>();

  if (!input.name.trim()) {
    warnings.add('Không nhận rõ tên thuốc. Vui lòng kiểm tra và nhập lại trước khi lưu.');
  }
  if (!input.strengthText.trim()) {
    warnings.add('Không nhận rõ hàm lượng hoặc quy cách.');
  }
  if (!input.directionsText.trim()) {
    warnings.add('Không nhận rõ hướng dẫn sử dụng.');
  }
  if (input.name.length > medicationFieldLimits.name) {
    warnings.add('Tên thuốc có thể quá dài; vui lòng đối chiếu lại đơn gốc.');
  }
  if (input.strengthText.length > medicationFieldLimits.strengthText) {
    warnings.add('Hàm lượng hoặc quy cách có thể quá dài; vui lòng đối chiếu lại đơn gốc.');
  }
  if (input.directionsText.length > medicationFieldLimits.directionsText) {
    warnings.add('Hướng dẫn sử dụng có thể quá dài; vui lòng đối chiếu lại đơn gốc.');
  }

  pageWarnings.forEach((warning) => {
    if (warning.trim()) {
      warnings.add(warning.trim());
    }
  });

  return [...warnings];
}

function appendDirection(candidate: MutableCandidate, line: string): void {
  const nextDirection = collapseWhitespace([candidate.input.directionsText, line].filter(Boolean).join(' '));
  candidate.input = { ...candidate.input, directionsText: nextDirection };
  candidate.sourceText = `${candidate.sourceText}\n${line}`;
}

/**
 * Conservative, deterministic parser for Vietnamese prescription OCR text.
 * It only creates candidates from a numbered, labelled, or strength-bearing
 * line and never invents a name, dose, frequency, or schedule.
 */
export function parsePrescriptionOcrPage(page: PrescriptionOcrPage): PrescriptionOcrCandidate[] {
  const lines = page.text
    .split(/\r?\n/)
    .map((line) => collapseWhitespace(line))
    .filter(Boolean);
  const candidates: MutableCandidate[] = [];
  let current: MutableCandidate | null = null;

  lines.forEach((line, lineIndex) => {
    if (isLikelyMedicationLine(line)) {
      const input = splitMedicationLine(line);

      // Do not create a fake medicine card for an OCR fragment that merely
      // resembles an instruction. The raw page text remains available to UI.
      if (!input.name) {
        current = null;
        return;
      }

      const candidate: MutableCandidate = {
        id: `ocr-${page.pageIndex}-${lineIndex}-${candidates.length + 1}`,
        pageIndex: page.pageIndex,
        input,
        sourceText: line,
        sourceReference: `Trang ${page.pageIndex + 1}, dòng ${lineIndex + 1}`,
        warnings: [],
      };
      candidates.push(candidate);
      current = candidate;
      return;
    }

    if (current && looksLikeDirection(line)) {
      appendDirection(current, line);
      return;
    }

    // An unclassified line is intentionally not merged into another medicine.
    // It remains visible in the original OCR text for manual entry/review.
    current = null;
  });

  return candidates.map((candidate) => ({
    ...candidate,
    input: { ...candidate.input },
    warnings: getCandidateWarnings(candidate.input, page.qualityWarnings),
  }));
}

export function parsePrescriptionOcrPages(pages: readonly PrescriptionOcrPage[]): PrescriptionOcrCandidate[] {
  return pages
    .slice()
    .sort((left, right) => left.pageIndex - right.pageIndex)
    .flatMap((page) => parsePrescriptionOcrPage(page));
}

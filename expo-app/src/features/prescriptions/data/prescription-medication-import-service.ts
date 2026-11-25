import {
  assertValidMedicationInput,
  MedicationValidationError,
} from '@/features/medications/domain/medication-validation';
import type { MedicationInput, MedicationRepository } from '@/features/medications/domain/medication-repository';

export type PrescriptionMedicationImportCandidate = Readonly<{
  id: string;
  selected: boolean;
  input: MedicationInput;
}>;

export type PrescriptionMedicationImportItemResult = Readonly<{
  candidateId: string;
  status: 'saved' | 'skippedDuplicate' | 'failed';
  message: string;
}>;

export type PrescriptionMedicationImportResult = Readonly<{
  results: readonly PrescriptionMedicationImportItemResult[];
  savedCount: number;
  duplicateCount: number;
  failedCount: number;
}>;

export type PrescriptionMedicationImportOptions = Readonly<{
  /** Explicit UI confirmation; OCR alone is never sufficient to save. */
  confirmed: true;
  userId: string;
  candidates: readonly PrescriptionMedicationImportCandidate[];
  /** Returns false after logout/account switching to discard stale work. */
  isCurrentSession?: () => boolean;
}>;

const activeImports = new Set<string>();

function normalizeCandidateId(value: string): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > 200) {
    throw new Error('Mục thuốc cần lưu không hợp lệ.');
  }
  return normalized;
}

function normalizeUserId(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }
  return normalized;
}

function medicationKey(input: MedicationInput): string {
  const normalized = assertValidMedicationInput(input);
  return [normalized.name, normalized.strengthText, normalized.directionsText]
    .map((value) => value.normalize('NFKC').toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ').trim())
    .join('\u0000');
}

function failed(candidateId: string, error: unknown): PrescriptionMedicationImportItemResult {
  if (error instanceof MedicationValidationError) {
    return {
      candidateId,
      status: 'failed',
      message: 'Thông tin thuốc cần được kiểm tra trước khi lưu.',
    };
  }

  return {
    candidateId,
    status: 'failed',
    message: error instanceof Error && error.message
      ? error.message
      : 'Không thể lưu thuốc này. Vui lòng thử lại.',
  };
}

function summarize(results: readonly PrescriptionMedicationImportItemResult[]): PrescriptionMedicationImportResult {
  return {
    results,
    savedCount: results.filter((item) => item.status === 'saved').length,
    duplicateCount: results.filter((item) => item.status === 'skippedDuplicate').length,
    failedCount: results.filter((item) => item.status === 'failed').length,
  };
}

/**
 * Sequential, explicit import to the existing MedicationRepository. There is
 * deliberately no client batch transaction because medications remain
 * independent owner records; the caller receives a result for every item.
 */
export class PrescriptionMedicationImportService {
  constructor(private readonly repository: MedicationRepository) {}

  async importConfirmedCandidates(
    options: PrescriptionMedicationImportOptions,
  ): Promise<PrescriptionMedicationImportResult> {
    if (options.confirmed !== true) {
      throw new Error('Vui lòng xác nhận trước khi lưu thuốc.');
    }

    const userId = normalizeUserId(options.userId);
    const lockKey = `prescription-import:${userId}`;

    if (activeImports.has(lockKey)) {
      throw new Error('Đang lưu thuốc từ đơn này. Vui lòng chờ hoàn tất.');
    }
    activeImports.add(lockKey);

    try {
      const selected = options.candidates.filter((candidate) => candidate.selected);
      const duplicateCandidateIds = new Set<string>();
      const normalizedInputs = new Map<string, MedicationInput>();
      const selectedKeys = new Map<string, string>();
      const preflightFailures: PrescriptionMedicationImportItemResult[] = [];

      selected.forEach((candidate) => {
        const candidateId = normalizeCandidateId(candidate.id);
        try {
          const normalized = assertValidMedicationInput(candidate.input);
          const key = medicationKey(normalized);
          if (selectedKeys.has(key)) {
            duplicateCandidateIds.add(candidateId);
          } else {
            selectedKeys.set(key, candidateId);
            normalizedInputs.set(candidateId, normalized);
          }
        } catch (error) {
          preflightFailures.push(failed(candidateId, error));
        }
      });

      if (options.isCurrentSession && !options.isCurrentSession()) {
        throw new Error('Phiên đăng nhập đã thay đổi. Không thể lưu thuốc từ đơn này.');
      }

      const existing = await this.repository.listMedications(userId);
      if (options.isCurrentSession && !options.isCurrentSession()) {
        throw new Error('Phiên đăng nhập đã thay đổi. Không thể lưu thuốc từ đơn này.');
      }

      const existingKeys = new Set(existing.map((medication) => medicationKey(medication)));
      const results: PrescriptionMedicationImportItemResult[] = [...preflightFailures];

      for (const candidate of selected) {
        const candidateId = normalizeCandidateId(candidate.id);
        if (results.some((item) => item.candidateId === candidateId)) {
          continue;
        }

        if (duplicateCandidateIds.has(candidateId)) {
          results.push({
            candidateId,
            status: 'skippedDuplicate',
            message: 'Trùng với một thuốc khác đang được chọn trong đơn này; chưa lưu thêm.',
          });
          continue;
        }

        const input = normalizedInputs.get(candidateId);
        if (!input) {
          results.push({ candidateId, status: 'failed', message: 'Thông tin thuốc không hợp lệ.' });
          continue;
        }

        const key = medicationKey(input);
        if (existingKeys.has(key)) {
          results.push({
            candidateId,
            status: 'skippedDuplicate',
            message: 'Thuốc có cùng thông tin đã có trong danh sách; chưa tạo bản ghi mới.',
          });
          continue;
        }

        if (options.isCurrentSession && !options.isCurrentSession()) {
          results.push({
            candidateId,
            status: 'failed',
            message: 'Phiên đăng nhập đã thay đổi; thuốc này chưa được lưu.',
          });
          continue;
        }

        try {
          await this.repository.createMedication(userId, input);
          if (options.isCurrentSession && !options.isCurrentSession()) {
            results.push({
              candidateId,
              status: 'failed',
              message: 'Phiên đăng nhập đã thay đổi; hãy tải lại danh sách thuốc để kiểm tra kết quả.',
            });
            continue;
          }
          existingKeys.add(key);
          results.push({ candidateId, status: 'saved', message: 'Đã lưu thuốc.' });
        } catch (error) {
          results.push(failed(candidateId, error));
        }
      }

      return summarize(results);
    } finally {
      activeImports.delete(lockKey);
    }
  }
}

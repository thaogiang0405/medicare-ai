import { create } from 'zustand';

import { getMedicationRepository } from '@/features/medications/data/medication-repository-selector';
import type { MedicationInput, MedicationRepository } from '@/features/medications/domain/medication-repository';

import { getPrescriptionOcrGateway } from './data/prescription-ocr-gateway-selector';
import { isPrescriptionOcrFeatureEnabled, prescriptionOcrUnavailableMessage } from './data/prescription-ocr-feature';
import {
  PrescriptionMedicationImportService,
  type PrescriptionMedicationImportResult,
} from './data/prescription-medication-import-service';
import { parsePrescriptionOcrPages } from './data/prescription-ocr-parser';
import { toPrescriptionOcrError } from './data/prescription-ocr-errors';
import {
  prescriptionOcrMaximumPages,
  type PrescriptionOcrCandidate,
  type PrescriptionOcrGateway,
  type PrescriptionOcrImagePage,
  type PrescriptionOcrResult,
  validatePrescriptionOcrRequest,
} from './domain/prescription-ocr';

export type PrescriptionOcrStoreStatus = 'idle' | 'ready' | 'processing' | 'review' | 'saving' | 'error';
export type PrescriptionCandidateSaveStatus = 'idle' | 'saved' | 'skippedDuplicate' | 'failed';

export type PrescriptionOcrReviewCandidate = PrescriptionOcrCandidate & Readonly<{
  selected: boolean;
  saveStatus: PrescriptionCandidateSaveStatus;
  saveMessage: string | null;
}>;

type MedicationRepositoryFactory = () => MedicationRepository;
type OcrFeatureEnabled = () => boolean;

export type PrescriptionOcrState = {
  /** Account identity is only set by the authenticated session integration. */
  activeUserId: string | null;
  status: PrescriptionOcrStoreStatus;
  pages: readonly PrescriptionOcrImagePage[];
  ocrResult: PrescriptionOcrResult | null;
  candidates: readonly PrescriptionOcrReviewCandidate[];
  consentAccepted: boolean;
  errorMessage: string | null;
  importResult: PrescriptionMedicationImportResult | null;
  bindAuthenticatedUser(userId: string | null): void;
  setPages(pages: readonly PrescriptionOcrImagePage[]): void;
  addPages(pages: readonly PrescriptionOcrImagePage[]): void;
  replacePage(pageId: string, replacement: PrescriptionOcrImagePage): void;
  removePage(pageId: string): void;
  movePage(fromIndex: number, toIndex: number): void;
  reorderPages(fromIndex: number, toIndex: number): void;
  setConsentAccepted(accepted: boolean): void;
  process(): Promise<void>;
  requestOcr(): Promise<void>;
  updateCandidate(candidateId: string, input: Partial<MedicationInput>): void;
  setCandidateSelected(candidateId: string, selected: boolean): void;
  toggleCandidate(candidateId: string): void;
  addManualCandidate(): void;
  removeCandidate(candidateId: string): void;
  confirmAndSave(): Promise<PrescriptionMedicationImportResult>;
  clearError(): void;
  cancel(): void;
  reset(): void;
};

function normalizeUserId(value: string | null): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

function normalizeCandidateId(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error('Mục thuốc cần chỉnh sửa không hợp lệ.');
  }
  return normalized;
}

function clonePages(pages: readonly PrescriptionOcrImagePage[]): PrescriptionOcrImagePage[] {
  return pages.map((page) => ({ ...page, qualityWarnings: [...page.qualityWarnings] }));
}

function toReviewCandidate(candidate: PrescriptionOcrCandidate): PrescriptionOcrReviewCandidate {
  return {
    ...candidate,
    input: { ...candidate.input },
    warnings: [...candidate.warnings],
    selected: true,
    saveStatus: 'idle',
    saveMessage: null,
  };
}

function getEditableWarnings(input: MedicationInput, existingWarnings: readonly string[]): string[] {
  const systemWarningPrefix = [
    'Không nhận rõ tên thuốc.',
    'Không nhận rõ hàm lượng hoặc quy cách.',
    'Không nhận rõ hướng dẫn sử dụng.',
  ];
  const warnings = existingWarnings.filter((warning) => !systemWarningPrefix.some((prefix) => warning.startsWith(prefix)));

  if (!input.name.trim()) {
    warnings.push('Không nhận rõ tên thuốc. Vui lòng kiểm tra và nhập lại trước khi lưu.');
  }
  if (!input.strengthText.trim()) {
    warnings.push('Không nhận rõ hàm lượng hoặc quy cách.');
  }
  if (!input.directionsText.trim()) {
    warnings.push('Không nhận rõ hướng dẫn sử dụng.');
  }

  return [...new Set(warnings)];
}

function toSafeErrorMessage(error: unknown): string {
  return toPrescriptionOcrError(error).message;
}

/**
 * In-memory review state only. It deliberately never writes images or OCR text
 * to AsyncStorage, analytics, Firestore, or another durable client store.
 */
export function createPrescriptionOcrStore(
  gateway: PrescriptionOcrGateway = getPrescriptionOcrGateway(),
  getRepository: MedicationRepositoryFactory = getMedicationRepository,
  isFeatureEnabled: OcrFeatureEnabled = isPrescriptionOcrFeatureEnabled,
) {
  let requestVersion = 0;
  let manualCandidateNumber = 0;

  return create<PrescriptionOcrState>((set, get) => {
    const invalidateRequest = () => {
      requestVersion += 1;
      return requestVersion;
    };

    const isCurrentRequest = (version: number, userId: string) =>
      version === requestVersion && get().activeUserId === userId;

    const clearDraft = (userId: string | null, status: PrescriptionOcrStoreStatus = 'idle') => {
      invalidateRequest();
      set({
        activeUserId: userId,
        status,
        pages: [],
        ocrResult: null,
        candidates: [],
        consentAccepted: false,
        errorMessage: null,
        importResult: null,
      });
    };

    return {
      activeUserId: null,
      status: 'idle',
      pages: [],
      ocrResult: null,
      candidates: [],
      consentAccepted: false,
      errorMessage: null,
      importResult: null,
      bindAuthenticatedUser: (userId) => {
        const normalizedUserId = normalizeUserId(userId);
        if (get().activeUserId !== normalizedUserId) {
          clearDraft(normalizedUserId, normalizedUserId ? 'ready' : 'idle');
        }
      },
      setPages: (pages) => {
        if (pages.length > prescriptionOcrMaximumPages) {
          set({
            status: 'error',
            errorMessage: `Mỗi lần chỉ có thể quét tối đa ${prescriptionOcrMaximumPages} trang đơn thuốc.`,
          });
          return;
        }

        invalidateRequest();
        set({
          pages: clonePages(pages),
          ocrResult: null,
          candidates: [],
          importResult: null,
          status: get().activeUserId ? 'ready' : 'idle',
          errorMessage: null,
        });
      },
      addPages: (pages) => {
        const combined = [...get().pages, ...pages];
        if (combined.length > prescriptionOcrMaximumPages) {
          set({
            status: 'error',
            errorMessage: `Mỗi lần chỉ có thể quét tối đa ${prescriptionOcrMaximumPages} trang đơn thuốc.`,
          });
          return;
        }
        get().setPages(combined);
      },
      replacePage: (pageId, replacement) => {
        const id = pageId.trim();
        if (!id || !get().pages.some((page) => page.id === id)) {
          return;
        }
        get().setPages(get().pages.map((page) => (page.id === id ? replacement : page)));
      },
      removePage: (pageId) => {
        const id = pageId.trim();
        invalidateRequest();
        set((state) => ({
          pages: state.pages.filter((page) => page.id !== id),
          ocrResult: null,
          candidates: [],
          importResult: null,
          status: state.activeUserId ? 'ready' : 'idle',
          errorMessage: null,
        }));
      },
      movePage: (fromIndex, toIndex) => {
        const pages = [...get().pages];
        if (
          !Number.isInteger(fromIndex)
          || !Number.isInteger(toIndex)
          || fromIndex < 0
          || toIndex < 0
          || fromIndex >= pages.length
          || toIndex >= pages.length
        ) {
          return;
        }

        const [moved] = pages.splice(fromIndex, 1);
        pages.splice(toIndex, 0, moved!);
        invalidateRequest();
        set({
          pages,
          ocrResult: null,
          candidates: [],
          importResult: null,
          status: get().activeUserId ? 'ready' : 'idle',
          errorMessage: null,
        });
      },
      reorderPages: (fromIndex, toIndex) => get().movePage(fromIndex, toIndex),
      setConsentAccepted: (accepted) => set({ consentAccepted: accepted, errorMessage: null }),
      process: async () => {
        const { activeUserId, pages, consentAccepted, status } = get();
        if (status === 'processing' || status === 'saving') {
          return;
        }
        if (!activeUserId) {
          set({ status: 'error', errorMessage: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' });
          return;
        }
        if (!isFeatureEnabled()) {
          set({ status: 'error', errorMessage: prescriptionOcrUnavailableMessage });
          return;
        }
        if (!consentAccepted) {
          set({ status: 'error', errorMessage: 'Vui lòng đồng ý gửi ảnh đơn thuốc tới Google Cloud trước khi quét.' });
          return;
        }

        const currentVersion = invalidateRequest();
        set({ status: 'processing', errorMessage: null, ocrResult: null, candidates: [], importResult: null });

        try {
          const request = validatePrescriptionOcrRequest({ consentAccepted: true, pages });
          const result = await gateway.recognizePrescription(activeUserId, request);

          if (!isCurrentRequest(currentVersion, activeUserId)) {
            return;
          }

          set({
            status: 'review',
            ocrResult: result,
            candidates: parsePrescriptionOcrPages(result.pages).map(toReviewCandidate),
            errorMessage: null,
          });
        } catch (error) {
          if (isCurrentRequest(currentVersion, activeUserId)) {
            set({ status: 'error', errorMessage: toSafeErrorMessage(error) });
          }
        }
      },
      requestOcr: async () => get().process(),
      updateCandidate: (candidateId, input) => {
        const id = normalizeCandidateId(candidateId);
        set((state) => ({
          candidates: state.candidates.map((candidate) => {
            if (candidate.id !== id) {
              return candidate;
            }
            const nextInput = { ...candidate.input, ...input };
            return {
              ...candidate,
              input: nextInput,
              warnings: getEditableWarnings(nextInput, candidate.warnings),
              saveStatus: 'idle',
              saveMessage: null,
            };
          }),
          importResult: null,
          errorMessage: null,
        }));
      },
      setCandidateSelected: (candidateId, selected) => {
        const id = normalizeCandidateId(candidateId);
        set((state) => ({
          candidates: state.candidates.map((candidate) => (candidate.id === id
            ? { ...candidate, selected, saveStatus: 'idle', saveMessage: null }
            : candidate)),
          importResult: null,
        }));
      },
      toggleCandidate: (candidateId) => {
        const id = normalizeCandidateId(candidateId);
        const candidate = get().candidates.find((item) => item.id === id);
        if (candidate) {
          get().setCandidateSelected(id, !candidate.selected);
        }
      },
      addManualCandidate: () => {
        manualCandidateNumber += 1;
        const id = `manual-${manualCandidateNumber}`;
        set((state) => ({
          candidates: [
            ...state.candidates,
            {
              id,
              pageIndex: -1,
              input: { name: '', strengthText: '', directionsText: '' },
              sourceText: '',
              sourceReference: 'Nhập thủ công',
              warnings: ['Thuốc này được thêm thủ công; vui lòng kiểm tra trước khi lưu.'],
              selected: true,
              saveStatus: 'idle',
              saveMessage: null,
            },
          ],
          importResult: null,
        }));
      },
      removeCandidate: (candidateId) => {
        const id = normalizeCandidateId(candidateId);
        set((state) => ({
          candidates: state.candidates.filter((candidate) => candidate.id !== id),
          importResult: null,
        }));
      },
      confirmAndSave: async () => {
        const { activeUserId, candidates, status } = get();
        if (!activeUserId) {
          throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        }
        if (status === 'saving' || status === 'processing') {
          throw new Error('Đang xử lý đơn thuốc. Vui lòng chờ hoàn tất.');
        }
        if (!candidates.some((candidate) => candidate.selected)) {
          throw new Error('Vui lòng chọn ít nhất một thuốc để lưu.');
        }

        const currentVersion = invalidateRequest();
        set({ status: 'saving', errorMessage: null, importResult: null });
        try {
          const result = await new PrescriptionMedicationImportService(getRepository()).importConfirmedCandidates({
            confirmed: true,
            userId: activeUserId,
            candidates: candidates.map((candidate) => ({
              id: candidate.id,
              selected: candidate.selected,
              input: candidate.input,
            })),
            isCurrentSession: () => isCurrentRequest(currentVersion, activeUserId),
          });

          if (!isCurrentRequest(currentVersion, activeUserId)) {
            return result;
          }

          const resultById = new Map(result.results.map((item) => [item.candidateId, item]));
          set((state) => ({
            status: 'review',
            importResult: result,
            candidates: state.candidates.map((candidate) => {
              const item = resultById.get(candidate.id);
              return item
                ? {
                    ...candidate,
                    selected: item.status === 'failed' ? candidate.selected : false,
                    saveStatus: item.status,
                    saveMessage: item.message,
                  }
                : candidate;
            }),
          }));
          return result;
        } catch (error) {
          if (isCurrentRequest(currentVersion, activeUserId)) {
            const message = error instanceof Error ? error.message : 'Không thể lưu thuốc từ đơn này.';
            set({ status: 'error', errorMessage: message });
          }
          throw error;
        }
      },
      clearError: () => set((state) => ({
        errorMessage: null,
        status: state.status === 'error' ? (state.activeUserId ? 'ready' : 'idle') : state.status,
      })),
      cancel: () => clearDraft(get().activeUserId, get().activeUserId ? 'ready' : 'idle'),
      reset: () => clearDraft(null),
    };
  });
}

export const usePrescriptionOcrStore = createPrescriptionOcrStore();

/** Called by the auth session reset path to purge a prior account's OCR draft. */
export function resetPrescriptionOcrSessionData(): void {
  usePrescriptionOcrStore.getState().reset();
}

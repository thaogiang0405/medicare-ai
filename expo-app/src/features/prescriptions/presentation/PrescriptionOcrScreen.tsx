import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Camera, CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

import {
  AppHeader,
  DemoModeBanner,
  PrimaryButton,
  SafetyNotice,
  Screen,
  SecondaryButton,
  TextField,
} from '@/components/medicare';
import {
  medicareAccessibility,
  medicareColors,
  medicareRadius,
  medicareSpacing,
  medicareTypography,
} from '@/constants/medicare-theme';
import { medicationFieldLimits } from '@/features/medications/domain/medication-repository';
import {
  isPrescriptionOcrFeatureEnabled,
  prescriptionOcrMaximumPages,
  usePrescriptionOcrStore,
  type PrescriptionOcrImagePage,
  type PrescriptionOcrProgress,
  type PrescriptionOcrReviewCandidate,
  type OcrSourceMode,
} from '@/features/prescriptions';
import { useSessionStore } from '@/store';

import {
  deleteTemporaryPrescriptionImages,
  deleteTemporaryPrescriptionUris,
  cropPrescriptionImageToNameBand,
  preparePrescriptionImage,
  type PickedPrescriptionImage,
} from './prescription-image-preparation';
import {
  LocalOfflineOcrBridgeHost,
  type LocalOfflineOcrEngineStatus,
} from './LocalOfflineOcrBridgeHost';

function toSafeCaptureError(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'Không thể chuẩn bị ảnh đơn thuốc. Vui lòng thử lại.';
}

function warningLabel(warning: string): string {
  const labels: Record<string, string> = {
    OCR_TEXT_EMPTY: 'Không nhận được chữ từ ảnh này. Hãy kiểm tra lại ảnh gốc hoặc thêm thuốc thủ công.',
    OCR_LOW_CONFIDENCE: 'Chất lượng nhận dạng thấp. Vui lòng đối chiếu kỹ với đơn gốc.',
    OCR_CONFIDENCE_UNAVAILABLE: 'Dịch vụ không cung cấp mức độ tin cậy. Vui lòng kiểm tra lại từng trường.',
    DEMO_SYNTHETIC_PROVIDER: 'Kết quả mô phỏng chỉ dành cho kiểm thử; không phải OCR thật.',
  };
  return labels[warning] ?? warning;
}

function localOcrProgressLabel(progress: PrescriptionOcrProgress | null): string {
  if (!progress) return 'Đang chuẩn bị nhận dạng cục bộ…';
  const page = `Trang ${progress.pageIndex + 1}/${progress.totalPages}`;
  const phase = {
    preparing: 'đang chuẩn bị ảnh',
    'loading-engine': 'đang nạp bộ nhận dạng',
    'loading-language': 'đang nạp ngôn ngữ Việt/Anh',
    recognizing: 'đang nhận dạng chữ',
    finalizing: 'đang hoàn tất',
  }[progress.phase];
  const percentage = progress.progress === null ? '' : ` ${Math.round(progress.progress * 100)}%`;
  return `${page} – ${phase}${percentage}.`;
}

/** Elderly-only screen; the parent layout protects the route and this screen binds each draft to its authenticated owner. */
export default function PrescriptionOcrScreen({ scanMode = 'prescription' }: Readonly<{ scanMode?: OcrSourceMode }>) {
  const sessionUserId = useSessionStore((state) => state.user?.id ?? null);
  const pages = usePrescriptionOcrStore((state) => state.pages);
  const activeUserId = usePrescriptionOcrStore((state) => state.activeUserId);
  const status = usePrescriptionOcrStore((state) => state.status);
  const consentAccepted = usePrescriptionOcrStore((state) => state.consentAccepted);
  const errorMessage = usePrescriptionOcrStore((state) => state.errorMessage);
  const ocrProgress = usePrescriptionOcrStore((state) => state.ocrProgress);
  const ocrResult = usePrescriptionOcrStore((state) => state.ocrResult);
  const candidates = usePrescriptionOcrStore((state) => state.candidates);
  const importResult = usePrescriptionOcrStore((state) => state.importResult);
  const bindAuthenticatedUser = usePrescriptionOcrStore((state) => state.bindAuthenticatedUser);
  const setSourceMode = usePrescriptionOcrStore((state) => state.setSourceMode);
  const addPages = usePrescriptionOcrStore((state) => state.addPages);
  const replacePage = usePrescriptionOcrStore((state) => state.replacePage);
  const removePage = usePrescriptionOcrStore((state) => state.removePage);
  const movePage = usePrescriptionOcrStore((state) => state.movePage);
  const setPages = usePrescriptionOcrStore((state) => state.setPages);
  const setConsentAccepted = usePrescriptionOcrStore((state) => state.setConsentAccepted);
  const process = usePrescriptionOcrStore((state) => state.process);
  const reviewPastedText = usePrescriptionOcrStore((state) => state.reviewPastedText);
  const updateCandidate = usePrescriptionOcrStore((state) => state.updateCandidate);
  const setCandidateSelected = usePrescriptionOcrStore((state) => state.setCandidateSelected);
  const addManualCandidate = usePrescriptionOcrStore((state) => state.addManualCandidate);
  const removeCandidate = usePrescriptionOcrStore((state) => state.removeCandidate);
  const confirmAndSave = usePrescriptionOcrStore((state) => state.confirmAndSave);
  const clearError = usePrescriptionOcrStore((state) => state.clearError);
  const cancel = usePrescriptionOcrStore((state) => state.cancel);

  const [captureError, setCaptureError] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const featureEnabled = isPrescriptionOcrFeatureEnabled();
  const [engineStatus, setEngineStatus] = useState<LocalOfflineOcrEngineStatus>(featureEnabled ? 'loading' : 'error');
  const [engineAttempt, setEngineAttempt] = useState(0);
  const pagesRef = useRef<readonly PrescriptionOcrImagePage[]>(pages);
  const captureInProgressRef = useRef(false);
  const boundUserRef = useRef<string | null>(null);
  const isProcessing = status === 'processing';
  const isSaving = status === 'saving';
  const selectedCount = candidates.filter((candidate) => candidate.selected).length;
  const canProcess = featureEnabled && engineStatus === 'ready' && Boolean(activeUserId) && pages.length > 0 && consentAccepted
    && !isCapturing && !isProcessing && !isSaving;

  const retryEngine = () => {
    if (isProcessing || isSaving) return;
    setEngineStatus('loading');
    setEngineAttempt((attempt) => attempt + 1);
  };

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  // Switching between scan modes cancels work and clears the previous draft.
  useEffect(() => {
    setSourceMode(scanMode);
  }, [scanMode, setSourceMode]);

  useEffect(() => {
    const nextUserId = sessionUserId?.trim() || null;
    if (boundUserRef.current && boundUserRef.current !== nextUserId) {
      deleteTemporaryPrescriptionImages(pagesRef.current);
    }
    if (boundUserRef.current !== nextUserId) setPastedText('');
    boundUserRef.current = nextUserId;
    bindAuthenticatedUser(nextUserId);
  }, [bindAuthenticatedUser, sessionUserId]);

  useEffect(() => () => {
    deleteTemporaryPrescriptionImages(pagesRef.current);
    usePrescriptionOcrStore.getState().cancel();
  }, []);

  const appendPreparedImages = async (sources: readonly PickedPrescriptionImage[], replaceId?: string) => {
    if (!sessionUserId || captureInProgressRef.current) {
      return;
    }

    const ownerId = sessionUserId;
    const currentPages = usePrescriptionOcrStore.getState().pages;
    const slots = replaceId ? 1 : prescriptionOcrMaximumPages - currentPages.length;
    const selectedSources = sources.slice(0, Math.max(0, slots));
    if (selectedSources.length === 0) {
      setCaptureError(`Mỗi lần chỉ có thể dùng tối đa ${prescriptionOcrMaximumPages} trang đơn thuốc.`);
      return;
    }

    captureInProgressRef.current = true;
    setIsCapturing(true);
    setCaptureError(null);
    clearError();
    const prepared: PrescriptionOcrImagePage[] = [];
    try {
      for (const source of selectedSources) {
        prepared.push(await preparePrescriptionImage(source));
      }

      const store = usePrescriptionOcrStore.getState();
      if (useSessionStore.getState().user?.id !== ownerId || store.activeUserId !== ownerId) {
        deleteTemporaryPrescriptionImages(prepared);
        return;
      }

      if (replaceId) {
        const previous = store.pages.find((page) => page.id === replaceId);
        replacePage(replaceId, prepared[0]!);
        if (previous) {
          deleteTemporaryPrescriptionImages([previous]);
        }
      } else {
        addPages(prepared);
      }
    } catch (error) {
      deleteTemporaryPrescriptionImages(prepared);
      setCaptureError(toSafeCaptureError(error));
    } finally {
      captureInProgressRef.current = false;
      setIsCapturing(false);
    }
  };

  const cropSelectedPackageName = async (page: PrescriptionOcrImagePage, relativeY: number) => {
    if (scanMode !== 'packaging' || captureInProgressRef.current || isProcessing || isSaving || !sessionUserId) return;
    const owner = sessionUserId;
    captureInProgressRef.current = true;
    setIsCapturing(true);
    setCaptureError(null);
    try {
      const cropped = await cropPrescriptionImageToNameBand(page, relativeY);
      const store = usePrescriptionOcrStore.getState();
      const stillPresent = store.pages.some((item) => item.id === page.id);
      if (useSessionStore.getState().user?.id !== owner || store.activeUserId !== owner || !stillPresent) {
        deleteTemporaryPrescriptionImages([cropped]);
        return;
      }
      replacePage(page.id, cropped);
      deleteTemporaryPrescriptionImages([page]);
    } catch (error) {
      setCaptureError(toSafeCaptureError(error));
    } finally {
      captureInProgressRef.current = false;
      setIsCapturing(false);
    }
  };

  const chooseFromLibrary = async (replaceId?: string) => {
    if (captureInProgressRef.current) return;
    setCaptureError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setCaptureError('Bạn chưa cho phép truy cập ảnh. Hãy cho phép quyền Ảnh trong Cài đặt hoặc dùng máy quét camera.');
        return;
      }
      const remaining = replaceId ? 1 : prescriptionOcrMaximumPages - usePrescriptionOcrStore.getState().pages.length;
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: !replaceId,
        base64: false,
        exif: false,
        mediaTypes: ['images'],
        orderedSelection: true,
        quality: 1,
        selectionLimit: Math.max(1, remaining),
      });
      if (!result.canceled && result.assets.length > 0) {
        await appendPreparedImages(result.assets.map((asset) => ({ uri: asset.uri })), replaceId);
      }
    } catch (error) {
      setCaptureError(toSafeCaptureError(error));
    }
  };

  const scanDocument = async (replaceId?: string) => {
    if (captureInProgressRef.current) return;
    if (!CameraView.isDocumentScannerAvailable) {
      setCaptureError('Máy quét tài liệu không sẵn sàng trên thiết bị này. Bạn vẫn có thể chọn ảnh từ thư viện.');
      return;
    }
    setCaptureError(null);
    try {
      const permission = await Camera.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setCaptureError('Bạn chưa cho phép dùng camera. Hãy cho phép quyền Camera trong Cài đặt hoặc chọn ảnh từ thư viện.');
        return;
      }
      const result = await CameraView.scanDocumentAsync({ quality: 0.82, requestPdf: false });
      if (result?.pages.length) {
        try {
          await appendPreparedImages(result.pages.map((uri) => ({ uri })), replaceId);
        } finally {
          // The system scanner stores source pages in the cache. Once the
          // re-encoded OCR preview is ready, retain neither scanner originals
          // nor discarded pages beyond this active interaction.
          deleteTemporaryPrescriptionUris(result.pages);
        }
      }
    } catch (error) {
      setCaptureError(toSafeCaptureError(error));
    }
  };

  const cancelAndLeave = () => {
    deleteTemporaryPrescriptionImages(pagesRef.current);
    cancel();
    router.replace('/elderly');
  };

  const rescanAll = async () => {
    deleteTemporaryPrescriptionImages(pagesRef.current);
    setPages([]);
    await scanDocument();
  };

  const handleSave = async () => {
    if (isSaving || isProcessing) return;
    try {
      const result = await confirmAndSave();
      if (result.failedCount > 0) return;
      const message = result.savedCount > 0
        ? `Đã lưu ${result.savedCount} thuốc. Bạn có thể tạo lịch uống thủ công trong mục Thuốc của tôi.`
        : 'Không tạo bản ghi mới vì các mục được chọn đã có trong danh sách hoặc chưa được chọn.';
      Alert.alert(result.savedCount ? 'Đã lưu thuốc' : 'Đã kiểm tra đơn thuốc', message, [{
        text: 'Mở Thuốc của tôi',
        onPress: () => {
          deleteTemporaryPrescriptionImages(pagesRef.current);
          cancel();
          router.replace('/elderly/medications');
        },
      }]);
    } catch {
      // The active store contains a localized safe error for this session.
    }
  };

  const handleReviewPastedText = () => {
    reviewPastedText(pastedText);
    if (usePrescriptionOcrStore.getState().status === 'review') setPastedText('');
  };

  const banner = useMemo(() => scanMode === 'packaging' ? {
    title: 'Đọc nhãn bao bì thuốc trên thiết bị',
    description: 'OCR cục bộ đọc chữ in trên hộp/vỉ thuốc, không nhận dạng viên thuốc bằng màu sắc hoặc hình dạng. Không dùng API trả phí.',
  } : featureEnabled ? {
    title: 'Nhận dạng đơn thuốc trên thiết bị',
    description: 'Ảnh và văn bản được xử lý cục bộ trên thiết bị. Không gửi ảnh đến dịch vụ OCR hoặc máy chủ bên thứ ba.',
  } : {
    title: 'Nhập đơn thuốc không mất phí',
    description: 'Có thể dán chữ sao chép từ Live Text trên iPhone, xem lại và lưu thuốc. Không gửi ảnh lên dịch vụ OCR trả phí.',
  }, [featureEnabled, scanMode]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardAvoidingView}>
      <Screen contentStyle={styles.content} testID="prescription-ocr-screen">
        {featureEnabled ? <LocalOfflineOcrBridgeHost key={engineAttempt} onEngineStatusChange={setEngineStatus} /> : null}
        <AppHeader backAccessibilityLabel="Quay lại trang chủ người cao tuổi" onBack={cancelAndLeave} subtitle={scanMode === 'packaging' ? 'Đọc nhãn hộp/vỉ, xác nhận thông tin trước khi lưu' : 'Chụp hoặc chọn ảnh, rồi kiểm tra kỹ trước khi lưu'} title={scanMode === 'packaging' ? 'Quét vỏ hộp thuốc' : 'Quét đơn thuốc'} />
        <DemoModeBanner description={banner.description} title={banner.title} />
        <SafetyNotice message={scanMode === 'packaging' ? 'Chữ trên bao bì có thể sai. Không thể xác minh thuốc bằng hình ảnh hay suy ra liều dùng. Hãy đối chiếu nhãn thật và hỏi dược sĩ nếu không rõ.' : 'AI có thể nhận dạng sai thông tin đơn thuốc. Vui lòng kiểm tra lại đơn gốc và xác nhận với nhân viên y tế nếu chưa chắc chắn.'} title="Kiểm tra trước khi lưu" tone="warning" />
        <ManualTextImportSection
          scanMode={scanMode}
          errorMessage={!featureEnabled ? errorMessage : null}
          onChangeText={setPastedText}
          onReview={handleReviewPastedText}
          text={pastedText}
        />
        {!featureEnabled ? <DisabledOcrState onBack={cancelAndLeave} /> : <>
          <ImageCollectionSection
            scanMode={scanMode}
            captureError={captureError}
            disabled={isCapturing || isProcessing || isSaving}
            isCapturing={isCapturing}
            onChoose={() => void chooseFromLibrary()}
            onCropNameBand={(page, y) => void cropSelectedPackageName(page, y)}
            onMoveDown={(index) => movePage(index, index + 1)}
            onMoveUp={(index) => movePage(index, index - 1)}
            onRemove={(page) => { deleteTemporaryPrescriptionImages([page]); removePage(page.id); }}
            onReplaceFromLibrary={(id) => void chooseFromLibrary(id)}
            onReplaceWithScanner={(id) => void scanDocument(id)}
            onRescanAll={() => void rescanAll()}
            onScan={() => void scanDocument()}
            pages={pages}
          />
          <ConsentAndProcessSection
            canProcess={canProcess}
            consentAccepted={consentAccepted}
            engineStatus={engineStatus}
            errorMessage={errorMessage}
            isProcessing={isProcessing}
            isSaving={isSaving}
            ocrProgress={ocrProgress}
            onCancel={cancel}
            onManualEntry={() => router.push('/elderly/medications/new')}
            onProcess={() => void process()}
            onRetryEngine={retryEngine}
            onToggleConsent={() => setConsentAccepted(!consentAccepted)}
          />
        </>}
        {ocrResult ? <OcrTextSection pages={ocrResult.pages} provider={ocrResult.provider} /> : null}
        {status === 'review' ? <ReviewSection
            scanMode={scanMode}
            candidates={candidates}
            importResult={importResult}
            isSaving={isSaving}
            onAddManual={addManualCandidate}
            onChange={(id, field, value) => updateCandidate(id, { [field]: value })}
            onConfirm={() => void handleSave()}
            onRemove={removeCandidate}
            onToggle={(id, selected) => setCandidateSelected(id, selected)}
            selectedCount={selectedCount}
          /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

function ManualTextImportSection({ text, onChangeText, onReview, errorMessage, scanMode }: Readonly<{
  scanMode: OcrSourceMode;
  text: string;
  onChangeText: (value: string) => void;
  onReview: () => void;
  errorMessage: string | null;
}>) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Dán văn bản bằng Live Text (miễn phí)</Text>
      <Text style={styles.sectionDescription}>
        {scanMode === 'packaging' ? 'Nếu ảnh bao bì khó quét, sao chép chữ bằng Live Text trong ứng dụng Ảnh và dán vào đây. Hãy đối chiếu với bao bì thật.' : 'Trên iPhone, mở ảnh trong ứng dụng Ảnh, chọn chữ bằng Live Text và nhấn Sao chép. Quay lại đây để dán. Không có dữ liệu nào được gửi đến dịch vụ OCR đám mây.'}
      </Text>
      <TextField
        accessibilityHint="Dán văn bản sao chép từ ảnh đơn thuốc hoặc nhập thủ công; tối đa 12.000 ký tự."
        label={scanMode === 'packaging' ? 'Chữ trên bao bì' : 'Nội dung đơn thuốc'}
        maxLength={12_000}
        multiline
        numberOfLines={5}
        onChangeText={onChangeText}
        placeholder="Ví dụ: 1. Paracetamol 500 mg – theo hướng dẫn trên đơn..."
        style={styles.multilineInput}
        testID="paste-prescription-text-input"
        textAlignVertical="top"
        value={text}
      />
      <PrimaryButton
        accessibilityHint="Phân tích văn bản đã dán trong phiên hiện tại, không gọi OCR đám mây"
        disabled={!text.trim()}
        label="Kiểm tra và tách thông tin thuốc"
        onPress={onReview}
        testID="review-pasted-prescription-button"
      />
      {errorMessage ? <SafetyNotice message={errorMessage} title="Không thể nhập văn bản" tone="error" /> : null}
    </View>
  );
}

function DisabledOcrState({ onBack }: Readonly<{ onBack: () => void }>) {
  return (
    <View style={styles.actions}>
      <SafetyNotice
        message="Nhận dạng ảnh cục bộ chưa được bật trong môi trường này. Bạn có thể dùng Live Text để sao chép chữ và dán ở trên, hoặc thêm từng thuốc thủ công."
        title="Quét ảnh cục bộ chưa được bật"
        tone="information"
      />
      <PrimaryButton accessibilityHint="Mở biểu mẫu thêm thuốc thủ công" label="Thêm thuốc thủ công" onPress={() => router.push('/elderly/medications/new')} />
      <SecondaryButton label="Quay lại trang chủ" onPress={onBack} />
    </View>
  );
}

function ImageCollectionSection({
  pages,
  scanMode,
  captureError,
  disabled,
  isCapturing,
  onScan,
  onChoose,
  onCropNameBand,
  onRescanAll,
  onRemove,
  onMoveUp,
  onMoveDown,
  onReplaceFromLibrary,
  onReplaceWithScanner,
}: Readonly<{
  pages: readonly PrescriptionOcrImagePage[];
  scanMode: OcrSourceMode;
  captureError: string | null;
  disabled: boolean;
  isCapturing: boolean;
  onScan: () => void;
  onChoose: () => void;
  onCropNameBand: (page: PrescriptionOcrImagePage, relativeY: number) => void;
  onRescanAll: () => void;
  onRemove: (page: PrescriptionOcrImagePage) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onReplaceFromLibrary: (id: string) => void;
  onReplaceWithScanner: (id: string) => void;
}>) {
  const full = pages.length >= prescriptionOcrMaximumPages;
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{scanMode === 'packaging' ? 'Ảnh vỏ hộp/vỉ thuốc' : 'Ảnh đơn thuốc'}</Text>
      <Text style={styles.sectionDescription}>{scanMode === 'packaging' ? 'Chọn tối đa 3 ảnh mặt hộp/vỉ có chữ rõ. Mỗi ảnh gợi ý tối đa một tên thuốc; không tự đưa ra liều dùng.' : `Chọn tối đa ${prescriptionOcrMaximumPages} trang. Ảnh được tối ưu tạm thời trong ứng dụng; không tự lưu vào Ảnh hoặc Firebase Storage.`}</Text>
      {captureError ? <SafetyNotice message={captureError} title="Không thể thêm ảnh" tone="error" /> : null}
      {pages.length === 0 ? <SafetyNotice message="Bạn có thể dùng máy quét tài liệu nếu thiết bị hỗ trợ, hoặc chọn ảnh đơn thuốc có sẵn." title="Chưa có ảnh đơn thuốc" tone="information" /> : null}
      {pages.map((page, index) => <ImagePageCard
        canMoveDown={index < pages.length - 1}
        scanMode={scanMode}
        onCropNameBand={(y) => onCropNameBand(page, y)}
        canMoveUp={index > 0}
        disabled={disabled}
        index={index}
        key={page.id}
        onMoveDown={() => onMoveDown(index)}
        onMoveUp={() => onMoveUp(index)}
        onRemove={() => onRemove(page)}
        onReplaceFromLibrary={() => onReplaceFromLibrary(page.id)}
        onReplaceWithScanner={() => onReplaceWithScanner(page.id)}
        page={page}
      />)}
      <View style={styles.actions}>
        <PrimaryButton accessibilityHint="Mở máy quét tài liệu để thêm trang đơn thuốc" disabled={disabled || full} label={isCapturing ? 'Đang chuẩn bị ảnh…' : pages.length ? 'Quét thêm bằng camera' : 'Quét bằng camera'} onPress={onScan} />
        <SecondaryButton accessibilityHint="Mở thư viện ảnh để chọn trang đơn thuốc" disabled={disabled || full} label="Chọn ảnh từ thư viện" onPress={onChoose} />
        {pages.length ? <SecondaryButton accessibilityHint="Xóa ảnh hiện tại rồi mở máy quét tài liệu để quét lại" disabled={disabled} label="Quét lại toàn bộ" onPress={onRescanAll} /> : null}
      </View>
    </View>
  );
}

function ImagePageCard({
  page,
  scanMode,
  onCropNameBand,
  index,
  disabled,
  canMoveUp,
  canMoveDown,
  onRemove,
  onMoveUp,
  onMoveDown,
  onReplaceFromLibrary,
  onReplaceWithScanner,
}: Readonly<{
  page: PrescriptionOcrImagePage;
  scanMode: OcrSourceMode;
  onCropNameBand: (relativeY: number) => void;
  index: number;
  disabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onReplaceFromLibrary: () => void;
  onReplaceWithScanner: () => void;
}>) {
  const [nameY, setNameY] = useState<number | null>(null);
  const [previewHeight, setPreviewHeight] = useState(0);
  const bandFraction = page.width / page.height >= 2.3 ? 0.42 : 0.15;
  const bandTop = nameY === null ? 0 : Math.max(0, Math.min(1 - bandFraction, nameY - bandFraction / 2));
  return (
    <View style={styles.imageCard}>
      {scanMode === 'packaging' ? <Text style={styles.sectionDescription}>Chạm vào dòng tên thuốc trên ảnh. Khung xanh cho biết phần sẽ quét; nhấn “Chỉ quét vùng tên đã chọn” trước khi nhận dạng.</Text> : null}
      {scanMode === 'packaging' ? (
        <Pressable
          accessibilityLabel="Chạm vào dòng tên thuốc trên ảnh bao bì"
          accessibilityRole="button"
          disabled={disabled}
          onLayout={(event) => setPreviewHeight(event.nativeEvent.layout.height)}
          onPress={(event) => {
            if (previewHeight <= 0) return;
            const y = event.nativeEvent.locationY / previewHeight;
            setNameY(Math.min(1, Math.max(0, y)));
          }}
          style={styles.imageSelectionSurface}
        >
          <Image accessibilityLabel={'Ảnh bao bì số ' + (index + 1)} resizeMode="contain" source={{ uri: page.uri }} style={[styles.previewImage, { aspectRatio: page.width / page.height }]} />
          {nameY !== null ? (
            <View pointerEvents="none" style={[styles.nameBandOverlay, { top: `${bandTop * 100}%` as `${number}%`, height: `${bandFraction * 100}%` as `${number}%` }]} />
          ) : null}
        </Pressable>
      ) : (
        <Image accessibilityLabel={'Ảnh đơn thuốc trang ' + (index + 1)} source={{ uri: page.uri }} style={styles.previewImage} />
      )}
      {scanMode === 'packaging' ? <SecondaryButton disabled={disabled || nameY === null} label="Chỉ quét vùng tên đã chọn" onPress={() => { if (nameY !== null) onCropNameBand(nameY); }} /> : null}
      <View style={styles.imageCardContent}>
        <Text style={styles.cardTitle}>Trang {index + 1}</Text>
        <Text style={styles.metadataText}>{Math.round(page.byteSize / 1024)} KB · {page.width} × {page.height}</Text>
        {page.qualityWarnings.map((warning) => <Text key={warning} style={styles.warningText}>• {warningLabel(warning)}</Text>)}
      </View>
      <View style={styles.inlineActions}>
        <SmallAction disabled={disabled || !canMoveUp} label="Lên" onPress={onMoveUp} />
        <SmallAction disabled={disabled || !canMoveDown} label="Xuống" onPress={onMoveDown} />
        <SmallAction disabled={disabled} label="Thay ảnh" onPress={onReplaceFromLibrary} />
        <SmallAction disabled={disabled} label="Quét lại" onPress={onReplaceWithScanner} />
        <SmallAction destructive disabled={disabled} label="Xóa" onPress={onRemove} />
      </View>
    </View>
  );
}

function SmallAction({ label, disabled, destructive = false, onPress }: Readonly<{
  label: string;
  disabled: boolean;
  destructive?: boolean;
  onPress: () => void;
}>) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.smallAction, destructive && styles.removeAction, disabled && styles.smallActionDisabled, pressed && !disabled && styles.pressed]}>
      <Text style={[styles.smallActionText, destructive && styles.removeActionText, disabled && styles.smallActionTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

function ConsentAndProcessSection({
  consentAccepted,
  canProcess,
  engineStatus,
  isProcessing,
  isSaving,
  errorMessage,
  ocrProgress,
  onToggleConsent,
  onProcess,
  onCancel,
  onRetryEngine,
  onManualEntry,
}: Readonly<{
  consentAccepted: boolean;
  canProcess: boolean;
  engineStatus: LocalOfflineOcrEngineStatus;
  isProcessing: boolean;
  isSaving: boolean;
  errorMessage: string | null;
  ocrProgress: PrescriptionOcrProgress | null;
  onToggleConsent: () => void;
  onProcess: () => void;
  onCancel: () => void;
  onRetryEngine: () => void;
  onManualEntry: () => void;
}>) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Xử lý OCR cục bộ</Text>
      <Pressable accessibilityHint="Bắt buộc trước khi xử lý ảnh đơn thuốc hoàn toàn trên thiết bị" accessibilityLabel="Đồng ý xử lý ảnh đơn thuốc trên thiết bị để nhận dạng chữ" accessibilityRole="checkbox" accessibilityState={{ checked: consentAccepted, disabled: isProcessing || isSaving }} disabled={isProcessing || isSaving} onPress={onToggleConsent} style={({ pressed }) => [styles.consentRow, consentAccepted && styles.consentRowChecked, pressed && !isProcessing && !isSaving && styles.pressed]}>
        <Checkbox checked={consentAccepted} />
        <Text style={styles.consentText}>Tôi đồng ý xử lý ảnh đơn thuốc trên thiết bị này để nhận dạng chữ. Tôi hiểu kết quả cần được kiểm tra lại trước khi lưu.</Text>
      </Pressable>
      {engineStatus === 'loading' ? <SafetyNotice message="Đang kiểm tra bộ nhận dạng tiếng Việt/Anh cục bộ. Ảnh chưa được xử lý hoặc gửi đi." title="Đang chuẩn bị OCR cục bộ" tone="information" /> : null}
      {engineStatus === 'error' ? <SafetyNotice message="Không thể khởi tạo OCR cục bộ trên thiết bị này. Bạn vẫn có thể dùng Live Text hoặc thêm thuốc thủ công." title="OCR cục bộ chưa sẵn sàng" tone="warning" /> : null}
      {isProcessing ? <SafetyNotice message={localOcrProgressLabel(ocrProgress)} title="Đang nhận dạng trên thiết bị" tone="information" /> : null}
      <PrimaryButton accessibilityHint="Xử lý các ảnh đã chọn ngay trên thiết bị sau khi bạn đã đồng ý" disabled={!canProcess} label={isProcessing ? 'Đang quét đơn thuốc…' : 'Nhận dạng chữ trên thiết bị'} loading={isProcessing} onPress={onProcess} testID="process-prescription-ocr-button" />
      {isProcessing ? <SecondaryButton label="Dừng quét" onPress={onCancel} /> : null}
      {engineStatus === 'error' ? <SecondaryButton label="Thử khởi tạo lại OCR cục bộ" onPress={onRetryEngine} /> : null}
      {errorMessage ? <View style={styles.actions}>
        <SafetyNotice message={errorMessage} title="Không thể quét hoặc lưu" tone="error" />
        {engineStatus === 'ready' ? <SecondaryButton disabled={!canProcess} label="Thử quét lại" onPress={onProcess} /> : null}
        <SecondaryButton label="Thêm thuốc thủ công" onPress={onManualEntry} />
      </View> : null}
    </View>
  );
}

function Checkbox({ checked }: Readonly<{ checked: boolean }>) {
  return <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked ? <Text style={styles.checkboxMark}>✓</Text> : null}</View>;
}

function OcrTextSection({ pages, provider }: Readonly<{
  pages: readonly { pageIndex: number; text: string; qualityWarnings: readonly string[] }[];
  provider: 'google-cloud-vision' | 'local-offline' | 'demo' | 'manual-import';
}>) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Nội dung nhận dạng</Text>
      <SafetyNotice message="Nội dung này chỉ hiển thị trong phiên hiện tại để bạn đối chiếu. Nó không được lưu vào Firestore hoặc bộ nhớ lâu dài của ứng dụng." title={provider === 'demo' ? 'Kết quả mô phỏng' : provider === 'manual-import' ? 'Văn bản bạn đã dán – không dùng OCR đám mây' : provider === 'local-offline' ? 'Kết quả OCR cục bộ trên thiết bị' : 'Kết quả OCR cũ từ Cloud'} tone={provider === 'demo' ? 'warning' : 'information'} />
      {pages.map((page) => <View key={page.pageIndex} style={styles.ocrTextCard}>
        <Text style={styles.cardTitle}>Trang {page.pageIndex + 1}</Text>
        {page.qualityWarnings.map((warning, index) => <Text key={`${warning}-${index}`} style={styles.warningText}>• {warningLabel(warning)}</Text>)}
        <Text selectable style={styles.ocrText}>{page.text || 'Không nhận được nội dung chữ từ trang này.'}</Text>
      </View>)}
    </View>
  );
}

function ReviewSection({
  scanMode,
  candidates,
  importResult,
  isSaving,
  selectedCount,
  onChange,
  onToggle,
  onRemove,
  onAddManual,
  onConfirm,
}: Readonly<{
  scanMode: OcrSourceMode;
  candidates: readonly PrescriptionOcrReviewCandidate[];
  importResult: { savedCount: number; duplicateCount: number; failedCount: number } | null;
  isSaving: boolean;
  selectedCount: number;
  onChange: (id: string, field: 'name' | 'strengthText' | 'directionsText', value: string) => void;
  onToggle: (id: string, selected: boolean) => void;
  onRemove: (id: string) => void;
  onAddManual: () => void;
  onConfirm: () => void;
}>) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>Thuốc cần kiểm tra</Text>
      <Text style={styles.sectionDescription}>{scanMode === 'packaging' ? 'Tên/hàm lượng là gợi ý từ nhãn in. Mục mặc định chưa chọn; hãy đối chiếu hộp thật và tích chọn trước khi lưu. Không có lịch uống tự động.' : 'Chỉ những mục bạn chọn và xác nhận mới được lưu. Ứng dụng không tạo lịch uống, không thay thuốc và không đưa ra liều dùng.'}</Text>
      {candidates.length === 0 ? <SafetyNotice message="Không có tên thuốc nào được nhận dạng một cách đủ rõ. Bạn có thể thêm mục thủ công và đối chiếu với đơn gốc." title="Cần kiểm tra thủ công" tone="warning" /> : null}
      {candidates.map((candidate, index) => <ReviewCandidateCard
        candidate={candidate}
        scanMode={scanMode}
        index={index}
        key={candidate.id}
        onChange={(field, value) => onChange(candidate.id, field, value)}
        onRemove={() => onRemove(candidate.id)}
        onToggle={() => onToggle(candidate.id, !candidate.selected)}
        saving={isSaving}
      />)}
      <SecondaryButton disabled={isSaving} label="Thêm một thuốc thủ công" onPress={onAddManual} />
      {importResult ? <SafetyNotice message={`Đã lưu ${importResult.savedCount}; không tạo ${importResult.duplicateCount} mục trùng; còn ${importResult.failedCount} mục cần kiểm tra hoặc thử lại.`} title={importResult.failedCount ? 'Lưu thuốc chưa hoàn tất' : 'Kết quả lưu thuốc'} tone={importResult.failedCount ? 'warning' : 'information'} /> : null}
      <PrimaryButton accessibilityHint="Lưu các mục thuốc đang chọn sau khi bạn đã kiểm tra với đơn gốc" disabled={isSaving || selectedCount === 0} label={isSaving ? 'Đang lưu thuốc…' : `Xác nhận và lưu thuốc${selectedCount ? ` (${selectedCount})` : ''}`} loading={isSaving} onPress={onConfirm} testID="confirm-prescription-medications-button" />
    </View>
  );
}

function ReviewCandidateCard({
  candidate,
  scanMode,
  index,
  saving,
  onChange,
  onToggle,
  onRemove,
}: Readonly<{
  candidate: PrescriptionOcrReviewCandidate;
  scanMode: OcrSourceMode;
  index: number;
  saving: boolean;
  onChange: (field: 'name' | 'strengthText' | 'directionsText', value: string) => void;
  onToggle: () => void;
  onRemove: () => void;
}>) {
  const saveStatus = candidate.saveMessage
    ? candidate.saveStatus === 'saved'
      ? `Đã lưu: ${candidate.saveMessage}`
      : candidate.saveStatus === 'skippedDuplicate'
        ? `Chưa tạo bản ghi trùng: ${candidate.saveMessage}`
        : `Chưa lưu: ${candidate.saveMessage}`
    : null;
  const immutable = saving || candidate.saveStatus === 'saved';
  return (
    <View style={[styles.candidateCard, candidate.selected && styles.candidateCardSelected]}>
      <Pressable accessibilityHint="Chọn hoặc bỏ chọn mục thuốc này trước khi xác nhận lưu" accessibilityLabel={`Chọn thuốc ${index + 1}`} accessibilityRole="checkbox" accessibilityState={{ checked: candidate.selected, disabled: immutable }} disabled={immutable} onPress={onToggle} style={styles.candidateHeading}>
        <Checkbox checked={candidate.selected} />
        <View style={styles.candidateHeadingText}><Text style={styles.cardTitle}>Thuốc {index + 1}</Text><Text style={styles.metadataText}>{candidate.sourceReference}</Text></View>
      </Pressable>
      {candidate.sourceText ? <Text style={styles.sourceText}>Từ OCR: {candidate.sourceText}</Text> : null}
      {candidate.warnings.map((warning, warningIndex) => <Text key={`${warning}-${warningIndex}`} style={styles.warningText}>• {warningLabel(warning)}</Text>)}
      {saveStatus ? <Text style={candidate.saveStatus === 'failed' ? styles.errorText : styles.statusText}>{saveStatus}</Text> : null}
      <View style={styles.candidateFields}>
        <TextField accessibilityHint="Bắt buộc. Kiểm tra và chỉnh sửa theo đơn gốc trước khi lưu" editable={!immutable} label="Tên thuốc *" maxLength={medicationFieldLimits.name} onChangeText={(value) => onChange('name', value)} placeholder={scanMode === 'packaging' ? 'Nhập tên đã kiểm tra trên hộp thật' : 'Nhập tên thuốc từ đơn gốc'} value={candidate.input.name} />
        <TextField accessibilityHint="Không bắt buộc. Chỉ ghi lại hàm lượng hoặc quy cách bạn xác nhận" editable={!immutable} label="Hàm lượng hoặc quy cách" maxLength={medicationFieldLimits.strengthText} onChangeText={(value) => onChange('strengthText', value)} placeholder="Ví dụ: 500 mg" value={candidate.input.strengthText} />
        <TextField accessibilityHint="Không bắt buộc. Chỉ ghi lại hướng dẫn từ đơn gốc; ứng dụng không tự tạo liều hoặc lịch" editable={!immutable} label={scanMode === 'packaging' ? 'Hướng dẫn đã xác minh (không tự suy ra)' : 'Hướng dẫn sử dụng đã ghi nhận'} maxLength={medicationFieldLimits.directionsText} multiline numberOfLines={3} onChangeText={(value) => onChange('directionsText', value)} placeholder="Nhập nội dung đã kiểm tra" style={styles.multilineInput} textAlignVertical="top" value={candidate.input.directionsText} />
      </View>
      {candidate.saveStatus !== 'saved' ? <SecondaryButton disabled={saving} label="Bỏ mục thuốc này" onPress={onRemove} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  keyboardAvoidingView: { flex: 1 },
  content: { gap: medicareSpacing.lg },
  section: { gap: medicareSpacing.md },
  sectionTitle: { color: medicareColors.text, fontSize: medicareTypography.subheading, fontWeight: '800', lineHeight: 29 },
  sectionDescription: { color: medicareColors.textMuted, fontSize: medicareTypography.body, lineHeight: medicareTypography.lineHeightBody },
  actions: { gap: medicareSpacing.sm },
  imageCard: { borderColor: medicareColors.border, borderRadius: medicareRadius.md, borderWidth: 1, gap: medicareSpacing.md, overflow: 'hidden', padding: medicareSpacing.md },
  previewImage: { aspectRatio: 4 / 3, backgroundColor: medicareColors.primaryContainer, borderRadius: medicareRadius.sm, width: '100%' },
  imageSelectionSurface: { position: 'relative', width: '100%' },
  nameBandOverlay: { position: 'absolute', left: 0, right: 0, height: '22%', backgroundColor: 'rgba(0,108,103,0.15)', borderColor: medicareColors.primary, borderWidth: 2, borderRadius: medicareRadius.sm },
  imageCardContent: { gap: medicareSpacing.xxs },
  cardTitle: { color: medicareColors.text, fontSize: medicareTypography.label, fontWeight: '800', lineHeight: 23 },
  metadataText: { color: medicareColors.textMuted, fontSize: medicareTypography.bodySmall, lineHeight: 22 },
  warningText: { color: medicareColors.warning, fontSize: medicareTypography.bodySmall, lineHeight: 22 },
  inlineActions: { flexDirection: 'row', flexWrap: 'wrap', gap: medicareSpacing.xs },
  smallAction: { alignItems: 'center', borderColor: medicareColors.primary, borderRadius: medicareRadius.sm, borderWidth: 1, justifyContent: 'center', minHeight: medicareAccessibility.minTouchTarget, paddingHorizontal: medicareSpacing.sm },
  smallActionDisabled: { borderColor: medicareColors.disabled, opacity: 0.65 },
  smallActionText: { color: medicareColors.primary, fontSize: medicareTypography.bodySmall, fontWeight: '700' },
  smallActionTextDisabled: { color: medicareColors.disabledText },
  removeAction: { borderColor: medicareColors.error },
  removeActionText: { color: medicareColors.error },
  pressed: { opacity: 0.76 },
  consentRow: { alignItems: 'flex-start', borderColor: medicareColors.border, borderRadius: medicareRadius.md, borderWidth: 1.5, flexDirection: 'row', gap: medicareSpacing.sm, minHeight: medicareAccessibility.minTouchTarget, padding: medicareSpacing.md },
  consentRowChecked: { backgroundColor: medicareColors.primaryContainer, borderColor: medicareColors.primary },
  checkbox: { alignItems: 'center', borderColor: medicareColors.primary, borderRadius: medicareRadius.sm, borderWidth: 2, height: 26, justifyContent: 'center', marginTop: 2, width: 26 },
  checkboxChecked: { backgroundColor: medicareColors.primary },
  checkboxMark: { color: medicareColors.onPrimary, fontSize: 18, fontWeight: '900' },
  consentText: { color: medicareColors.text, flex: 1, fontSize: medicareTypography.body, lineHeight: medicareTypography.lineHeightBody },
  ocrTextCard: { backgroundColor: medicareColors.surfaceElevated, borderColor: medicareColors.border, borderRadius: medicareRadius.md, borderWidth: 1, gap: medicareSpacing.xs, padding: medicareSpacing.md },
  ocrText: { color: medicareColors.text, fontSize: medicareTypography.bodySmall, lineHeight: 22 },
  candidateCard: { borderColor: medicareColors.border, borderRadius: medicareRadius.md, borderWidth: 1.5, gap: medicareSpacing.md, padding: medicareSpacing.md },
  candidateCardSelected: { borderColor: medicareColors.primary },
  candidateHeading: { alignItems: 'center', flexDirection: 'row', gap: medicareSpacing.sm, minHeight: medicareAccessibility.minTouchTarget },
  candidateHeadingText: { flex: 1, gap: medicareSpacing.xxs },
  sourceText: { color: medicareColors.textMuted, fontSize: medicareTypography.bodySmall, fontStyle: 'italic', lineHeight: 22 },
  statusText: { color: medicareColors.secondary, fontSize: medicareTypography.bodySmall, fontWeight: '700', lineHeight: 22 },
  errorText: { color: medicareColors.error, fontSize: medicareTypography.bodySmall, fontWeight: '700', lineHeight: 22 },
  candidateFields: { gap: medicareSpacing.md },
  multilineInput: { minHeight: 100 },
});

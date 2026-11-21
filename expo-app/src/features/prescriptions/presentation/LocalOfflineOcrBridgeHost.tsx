import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  registerLocalOfflineOcrPort,
  type LocalOfflineOcrPageInput,
  type LocalOfflineOcrPageProgress,
  type LocalOfflineOcrPageResult,
  type LocalOfflineOcrPort,
} from '../data/local-offline-ocr-bridge';
import { PrescriptionOcrError } from '../data/prescription-ocr-errors';
import LocalOfflineOcrDom, { type LocalOfflineOcrDomJob } from './LocalOfflineOcrDom';

export type LocalOfflineOcrEngineStatus = 'loading' | 'ready' | 'error';

type PendingJob = Readonly<{
  id: string;
  resolve: (result: LocalOfflineOcrPageResult) => void;
  reject: (error: PrescriptionOcrError) => void;
  onProgress?: (progress: LocalOfflineOcrPageProgress) => void;
  removeAbortListener: () => void;
}>;

export type LocalOfflineOcrBridgeHostProps = Readonly<{
  onEngineStatusChange?: (status: LocalOfflineOcrEngineStatus) => void;
}>;

function newJobId(): string {
  return `local-ocr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cancellationError(): PrescriptionOcrError {
  return new PrescriptionOcrError('cancelled', 'Đã dừng nhận dạng ảnh đơn thuốc.');
}

function engineUnavailableError(): PrescriptionOcrError {
  return new PrescriptionOcrError(
    'unavailable',
    'Bộ nhận dạng chữ trên thiết bị chưa sẵn sàng. Vui lòng thử lại hoặc thêm thuốc thủ công.',
  );
}

/**
 * Native-side owner of the DOM/WebView bridge. It holds at most one page's
 * base64 bytes at a time and drops callbacks whose opaque job ID is stale.
 */
export function LocalOfflineOcrBridgeHost({ onEngineStatusChange }: LocalOfflineOcrBridgeHostProps) {
  const [job, setJob] = useState<LocalOfflineOcrDomJob | null>(null);
  const statusRef = useRef<LocalOfflineOcrEngineStatus>('loading');
  const pendingRef = useRef<PendingJob | null>(null);

  const rejectPending = useCallback((error: PrescriptionOcrError) => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = null;
    pending.removeAbortListener();
    setJob(null);
    pending.reject(error);
  }, []);

  const setEngineStatus = useCallback((status: LocalOfflineOcrEngineStatus) => {
    statusRef.current = status;
    onEngineStatusChange?.(status);
    if (status === 'error') {
      rejectPending(engineUnavailableError());
    }
  }, [onEngineStatusChange, rejectPending]);

  const onEngineReady = useCallback(async () => {
    setEngineStatus('ready');
  }, [setEngineStatus]);

  const onEngineError = useCallback(async () => {
    setEngineStatus('error');
  }, [setEngineStatus]);

  const port = useMemo<LocalOfflineOcrPort>(() => ({
      isReady: () => statusRef.current === 'ready',
      recognizePage: (page: LocalOfflineOcrPageInput, options) => {
        if (statusRef.current !== 'ready') {
          return Promise.reject(engineUnavailableError());
        }
        if (options.signal?.aborted) {
          return Promise.reject(cancellationError());
        }

        // The gateway is sequential, but fail closed if an integration error
        // attempts to enqueue another page before the previous one settles.
        if (pendingRef.current) {
          rejectPending(cancellationError());
        }

        return new Promise<LocalOfflineOcrPageResult>((resolve, reject) => {
          const id = newJobId();
          const handleAbort = () => rejectPending(cancellationError());
          options.signal?.addEventListener('abort', handleAbort, { once: true });

          pendingRef.current = {
            id,
            resolve,
            reject,
            onProgress: options.onProgress,
            removeAbortListener: () => options.signal?.removeEventListener('abort', handleAbort),
          };
          setJob({ id, page });
        });
      },
      cancelActivePage: () => rejectPending(cancellationError()),
    }), [rejectPending]);

  const onProgress = useCallback(async (event: Readonly<{ jobId: string; progress: LocalOfflineOcrPageProgress }>) => {
    const pending = pendingRef.current;
    if (pending?.id === event.jobId) {
      pending.onProgress?.(event.progress);
    }
  }, []);

  const onResult = useCallback(async (event: Readonly<{ jobId: string; result: LocalOfflineOcrPageResult }>) => {
    const pending = pendingRef.current;
    if (!pending || pending.id !== event.jobId) return;
    pendingRef.current = null;
    pending.removeAbortListener();
    setJob(null);
    pending.resolve(event.result);
  }, []);

  const onCancelled = useCallback(async (event: Readonly<{ jobId: string }>) => {
    const pending = pendingRef.current;
    if (pending?.id === event.jobId) {
      rejectPending(cancellationError());
    }
  }, [rejectPending]);

  const onError = useCallback(async (event: Readonly<{ jobId: string }>) => {
    const pending = pendingRef.current;
    if (pending?.id === event.jobId) {
      rejectPending(engineUnavailableError());
    }
  }, [rejectPending]);

  useEffect(() => {
    const unregister = registerLocalOfflineOcrPort(port);
    return () => {
      unregister();
      port.cancelActivePage();
    };
  }, [port]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.hiddenHost}
    >
      <LocalOfflineOcrDom
        dom={{ matchContents: false, useExpoDOMWebView: false }}
        job={job}
        onCancelled={onCancelled}
        onEngineError={onEngineError}
        onEngineReady={onEngineReady}
        onError={onError}
        onProgress={onProgress}
        onResult={onResult}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Keep the trusted DOM/WebView mounted without exposing an empty visual or
  // accessibility node. `display: none` would prevent a WebView from running.
  hiddenHost: {
    height: 1,
    left: -10,
    opacity: 0.01,
    position: 'absolute',
    top: -10,
    width: 1,
  },
});

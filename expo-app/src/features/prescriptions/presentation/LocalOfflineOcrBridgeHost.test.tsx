import { act, render, waitFor } from '@testing-library/react-native';

import {
  getLocalOfflineOcrPort,
  resetLocalOfflineOcrPortForTests,
} from '../data/local-offline-ocr-bridge';
import { LocalOfflineOcrBridgeHost } from './LocalOfflineOcrBridgeHost';

let mockEngineFails = false;

jest.mock('./LocalOfflineOcrDom', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  function MockLocalOfflineOcrDom({ job, onEngineReady, onEngineError, onProgress, onResult }: {
    job: { id: string; page: { base64: string } } | null;
    onEngineReady: () => Promise<void>;
    onEngineError: () => Promise<void>;
    onProgress: (value: { jobId: string; progress: { phase: 'recognizing'; progress: number } }) => Promise<void>;
    onResult: (value: { jobId: string; result: { text: string; confidence: number; qualityWarnings: string[] } }) => Promise<void>;
  }) {
    React.useEffect(() => {
      void (mockEngineFails ? onEngineError() : onEngineReady());
    }, [onEngineError, onEngineReady]);
    React.useEffect(() => {
      if (!job) return;
      void onProgress({ jobId: job.id, progress: { phase: 'recognizing', progress: 0.5 } });
      void onResult({
        jobId: job.id,
        result: { text: 'Paracetamol 500 mg', confidence: 0.94, qualityWarnings: [] },
      });
    }, [job, onProgress, onResult]);
    return null;
  }

  return {
    __esModule: true,
    default: MockLocalOfflineOcrDom,
  };
});

describe('LocalOfflineOcrBridgeHost', () => {
  afterEach(() => {
    mockEngineFails = false;
    resetLocalOfflineOcrPortForTests();
  });

  it('bridges a local DOM result back to native without persisting image bytes', async () => {
    const screen = await render(<LocalOfflineOcrBridgeHost />);

    await waitFor(() => expect(getLocalOfflineOcrPort()?.isReady()).toBe(true));
    const port = getLocalOfflineOcrPort();
    expect(port).not.toBeNull();
    const progress = jest.fn();
    let pending: Promise<Awaited<ReturnType<NonNullable<typeof port>['recognizePage']>>> | undefined;

    await act(async () => {
      pending = port!.recognizePage({
        id: 'page-a',
        pageIndex: 0,
        mimeType: 'image/jpeg',
        base64: 'YWJj',
        width: 100,
        height: 100,
        sourceMode: 'prescription',
      }, { onProgress: progress });
    });

    const result = await pending;
    expect(result).toEqual({ text: 'Paracetamol 500 mg', confidence: 0.94, qualityWarnings: [] });
    expect(progress).toHaveBeenCalledWith({ phase: 'recognizing', progress: 0.5 });
    await screen.unmount();
    expect(getLocalOfflineOcrPort()).toBeNull();
  });

  it('allows a failed engine host to be remounted for a local retry', async () => {
    mockEngineFails = true;
    const statuses = jest.fn();
    const screen = await render(<LocalOfflineOcrBridgeHost onEngineStatusChange={statuses} />);

    await waitFor(() => expect(statuses).toHaveBeenCalledWith('error'));
    expect(getLocalOfflineOcrPort()?.isReady()).toBe(false);

    mockEngineFails = false;
    await screen.rerender(<LocalOfflineOcrBridgeHost key="retry" onEngineStatusChange={statuses} />);

    await waitFor(() => expect(statuses).toHaveBeenCalledWith('ready'));
    expect(getLocalOfflineOcrPort()?.isReady()).toBe(true);
    await screen.unmount();
  });
});

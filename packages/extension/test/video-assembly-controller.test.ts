import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  VideoAssemblyController,
  type VideoAssemblyDependencies,
} from '../src/background/video-assembly-controller';
import type { AssemblyClient } from '../src/background/assembly-client';
import { AssemblyRequestError } from '../src/background/assembly-client';
import type { VideoSourceProbeResult } from '../src/background/video-source-probe';

function createHarness(
  probe: VideoSourceProbeResult,
  options: {
    fillGaps?: boolean;
    fetchRange?: (tabId: number, url: string, start: number, end: number) => Promise<Uint8Array>;
  } = {}
) {
  let jobSequence = 0;
  const createJob = vi.fn(async () => {
    jobSequence += 1;
    return { jobId: `job-${jobSequence}`, token: `token-${jobSequence}` };
  });
  const writeChunk = vi.fn(async () => ({ receivedBytes: 0 }));
  const complete = vi.fn(async () => ({ hash: 'h1', duplicate: false, size: 100 }));
  const abort = vi.fn(async () => undefined);
  const client = {
    createJob,
    writeChunk,
    complete,
    abort,
  } as unknown as AssemblyClient;

  const sendCommand = vi.fn(async () => ({ body: '', base64Encoded: false }));
  const probeSources = vi.fn(async () => probe);
  const fetchRange = vi.fn(
    options.fetchRange ??
      (async (_tabId: number, _url: string, start: number, end: number) =>
        new Uint8Array(end - start + 1))
  );
  const onSkip = vi.fn();
  const onFailed = vi.fn();
  const onComplete = vi.fn();
  const onAssembling = vi.fn();

  let clock = 1_000;
  const dependencies: VideoAssemblyDependencies = {
    sendCommand,
    probeSources,
    fetchRange,
    getFillGaps: () => options.fillGaps === true,
    client,
    now: () => clock,
    onSkip,
    onFailed,
    onComplete,
    onAssembling,
    onActiveJobsChanged: vi.fn(),
  };

  const controller = new VideoAssemblyController(dependencies);
  return {
    controller,
    createJob,
    abort,
    writeChunk,
    complete,
    fetchRange,
    sendCommand,
    probeSources,
    onSkip,
    onFailed,
    onComplete,
    onAssembling,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

const mediaUrl =
  'https://v95-web-sz.douyinvod.com/4b849/video/tos/cn/o8ETaIsECLfGUGduAfc1/?mime_type=video_mp4&__vid=7710926097772479141';
const pageUrl = 'https://www.douyin.com/video/7710926097772479141';

function input(requestId: string, overrides: Record<string, unknown> = {}) {
  return {
    tabId: 1,
    requestId,
    url: mediaUrl,
    mimeType: 'video/mp4',
    status: 200,
    contentRange: null,
    total: 5_000_000,
    range: { start: 0, end: 4_999_999 },
    pageUrl,
    capturedAt: '2026-11-22T00:00:00.000Z',
    ...overrides,
  };
}

describe('VideoAssemblyController source evidence', () => {
  it('accepts a 206 response without probing the page', async () => {
    const harness = createHarness({ status: 'unverified', sources: [], hasSrcObject: false });

    await harness.controller.registerResponse(
      input('r1', {
        status: 206,
        contentRange: 'bytes 0-1048575/5000000',
        range: { start: 0, end: 1_048_575 },
      })
    );

    expect(harness.probeSources).not.toHaveBeenCalled();
    expect(harness.createJob).toHaveBeenCalledTimes(1);
    expect(harness.onSkip).not.toHaveBeenCalled();
  });

  it('accepts a 200 response when the media id matches the page id', async () => {
    const harness = createHarness({ status: 'unverified', sources: [], hasSrcObject: false });

    await harness.controller.registerResponse(input('r1'));

    expect(harness.createJob).toHaveBeenCalledTimes(1);
  });

  it('accepts a 200 response with a stable-id source match', async () => {
    const harness = createHarness({
      status: 'progressive',
      sources: [
        'https://v3-web.douyinvod.com/other/o8ETaIsECLfGUGduAfc1/?__vid=7710926097772479141',
      ],
      hasSrcObject: false,
    });

    await harness.controller.registerResponse(input('r1', { pageUrl: 'https://www.douyin.com/' }));

    expect(harness.probeSources).toHaveBeenCalledTimes(1);
    expect(harness.createJob).toHaveBeenCalledTimes(1);
  });

  it('skips an all-blob MSE source', async () => {
    const harness = createHarness({
      status: 'mse',
      sources: ['blob:https://www.douyin.com/uuid'],
      hasSrcObject: true,
    });

    await harness.controller.registerResponse(input('r1', { pageUrl: 'https://www.douyin.com/' }));

    expect(harness.createJob).not.toHaveBeenCalled();
    expect(harness.onSkip).toHaveBeenCalledWith(expect.objectContaining({ reason: 'in-memory' }));
  });

  it('retries unverified sources before reporting a terminal skip', async () => {
    const harness = createHarness({ status: 'unverified', sources: [], hasSrcObject: false });
    const pageWithoutId = 'https://www.douyin.com/';
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

    await harness.controller.registerResponse(input('r1', { pageUrl: pageWithoutId }));
    await flush();
    expect(harness.onSkip).not.toHaveBeenCalled();

    harness.advance(1_100);
    await harness.controller.registerResponse(input('r2', { pageUrl: pageWithoutId }));
    await flush();
    expect(harness.onSkip).not.toHaveBeenCalled();

    harness.advance(1_100);
    await harness.controller.registerResponse(input('r3', { pageUrl: pageWithoutId }));
    await flush();

    expect(harness.createJob).not.toHaveBeenCalled();
    expect(harness.onSkip).toHaveBeenCalledTimes(1);
    expect(harness.onSkip).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'unverified-source',
        detail: expect.stringContaining('attempts=3'),
      })
    );

    await harness.controller.cancelAll();
  });

  it('does not create duplicate jobs when a second range arrives', async () => {
    const harness = createHarness({ status: 'unverified', sources: [], hasSrcObject: false });

    await harness.controller.registerResponse(
      input('r1', {
        status: 206,
        contentRange: 'bytes 0-999999/5000000',
        range: { start: 0, end: 999_999 },
      })
    );
    await harness.controller.registerResponse(
      input('r2', {
        status: 206,
        contentRange: 'bytes 1000000-1999999/5000000',
        range: { start: 1_000_000, end: 1_999_999 },
      })
    );

    expect(harness.createJob).toHaveBeenCalledTimes(1);
    await harness.controller.cancelAll();
  });
});

describe('VideoAssemblyController page-scoped media', () => {
  it('ignores feed media that does not match modal_id', async () => {
    const harness = createHarness({ status: 'unverified', sources: [], hasSrcObject: false });
    const feedUrl = mediaUrl.replace('__vid=7710926097772479141', '__vid=7709440203223502757');

    await harness.controller.registerResponse(
      input('r1', {
        url: feedUrl,
        status: 206,
        contentRange: 'bytes 0-1048575/9863325',
        range: { start: 0, end: 1_048_575 },
      })
    );

    expect(harness.createJob).not.toHaveBeenCalled();
    expect(harness.onSkip).not.toHaveBeenCalled();
    await harness.controller.cancelAll();
  });

  it('evicts non-matching jobs when the page focuses a modal', async () => {
    const harness = createHarness({ status: 'unverified', sources: [], hasSrcObject: false });
    const pageWithoutId = 'https://www.douyin.com/search/foo?type=general';

    await harness.controller.registerResponse(
      input('r1', {
        pageUrl: pageWithoutId,
        status: 206,
        contentRange: 'bytes 0-1048575/9863325',
        range: { start: 0, end: 1_048_575 },
      })
    );
    expect(harness.createJob).toHaveBeenCalledTimes(1);

    const modalId = '7709440203223502757';
    const modalUrl = mediaUrl.replace('__vid=7710926097772479141', `__vid=${modalId}`);
    const modalPage = `https://www.douyin.com/search/foo?modal_id=${modalId}&type=general`;

    await harness.controller.registerResponse(
      input('r2', {
        url: modalUrl,
        pageUrl: modalPage,
        status: 206,
        contentRange: 'bytes 0-1048575/9863325',
        range: { start: 0, end: 1_048_575 },
      })
    );

    expect(harness.abort).toHaveBeenCalledWith(expect.objectContaining({ jobId: 'job-1' }));
    expect(harness.createJob).toHaveBeenCalledTimes(2);
    await harness.controller.cancelAll();
  });
});

describe('VideoAssemblyController diagnostics', () => {
  it('defers capacity instead of permanently skipping', async () => {
    const harness = createHarness({ status: 'unverified', sources: [], hasSrcObject: false });
    harness.createJob.mockRejectedValueOnce(new AssemblyRequestError(429, 'x'.repeat(500)));

    await harness.controller.registerResponse(
      input('r1', {
        status: 206,
        contentRange: 'bytes 0-1048575/9863325',
        range: { start: 0, end: 1_048_575 },
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(harness.onSkip).not.toHaveBeenCalled();

    await harness.controller.registerResponse(
      input('r2', {
        status: 206,
        contentRange: 'bytes 1048576-2097151/9863325',
        range: { start: 1_048_576, end: 2_097_151 },
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(harness.createJob).toHaveBeenCalledTimes(2);
    expect(harness.onSkip).not.toHaveBeenCalled();
    await harness.controller.cancelAll();
  });

  it('never puts the full signed query into skip detail', async () => {
    const harness = createHarness({ status: 'unverified', sources: [], hasSrcObject: false });
    const pageWithoutId = 'https://www.douyin.com/';

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await harness.controller.registerResponse(input(`r${attempt}`, { pageUrl: pageWithoutId }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      harness.advance(1_100);
    }

    const info = harness.onSkip.mock.calls[0][0] as { detail?: string };
    expect(info.detail).toBeTruthy();
    expect(info.detail).not.toContain('mime_type=');
    expect(info.detail).not.toContain('__vid=');

    await harness.controller.cancelAll();
  });
});

describe('VideoAssemblyController missing-head handling', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const tailOnly = {
    status: 206,
    contentRange: 'bytes 5-9/10',
    range: { start: 5, end: 9 },
    total: 10,
    pageUrl: 'https://www.douyin.com/',
  };

  it('warns to reload when the first range starts after zero', async () => {
    const harness = createHarness({ status: 'unverified', sources: [], hasSrcObject: false });

    await harness.controller.registerResponse(input('r1', tailOnly));

    expect(harness.onAssembling).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.stringContaining('hint=reload-page'),
      })
    );
    await harness.controller.cancelAll();
  });

  it('fills the missing head when the setting is enabled', async () => {
    vi.useFakeTimers();
    const harness = createHarness(
      { status: 'unverified', sources: [], hasSrcObject: false },
      {
        fillGaps: true,
        fetchRange: async (_tabId, _url, start, end) => new Uint8Array(end - start + 1),
      }
    );
    harness.sendCommand.mockResolvedValueOnce({ body: 'abcde', base64Encoded: false });

    await harness.controller.registerResponse(input('r1', tailOnly));
    harness.controller.handleLoadingFinished(1, 'r1');
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1600);

    expect(harness.writeChunk).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-1' }),
      5,
      expect.any(Uint8Array)
    );
    expect(harness.fetchRange).toHaveBeenCalledWith(1, mediaUrl, 0, 4);
    expect(harness.writeChunk).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-1' }),
      0,
      expect.any(Uint8Array)
    );
    expect(harness.complete).toHaveBeenCalledTimes(1);
    expect(harness.onComplete).toHaveBeenCalledTimes(1);

    await harness.controller.cancelAll();
  });
});

describe('VideoAssemblyController cancellation during fill', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lets an in-flight head fill finish before cancelling', async () => {
    vi.useFakeTimers();
    let resolveFetch: ((bytes: Uint8Array) => void) | null = null;
    const pendingFetch = new Promise<Uint8Array>((resolve) => {
      resolveFetch = resolve;
    });
    const harness = createHarness(
      { status: 'unverified', sources: [], hasSrcObject: false },
      {
        fillGaps: true,
        fetchRange: () => pendingFetch,
      }
    );
    harness.sendCommand.mockResolvedValueOnce({ body: 'abcde', base64Encoded: false });

    await harness.controller.registerResponse(
      input('r1', {
        status: 206,
        contentRange: 'bytes 5-9/10',
        range: { start: 5, end: 9 },
        total: 10,
        pageUrl: 'https://www.douyin.com/',
      })
    );
    harness.controller.handleLoadingFinished(1, 'r1');
    await vi.advanceTimersByTimeAsync(0);

    const cancellation = harness.controller.cancelTab(1);
    resolveFetch!(new Uint8Array(5));
    await vi.advanceTimersByTimeAsync(0);
    await cancellation;
    await vi.advanceTimersByTimeAsync(0);

    expect(harness.complete).toHaveBeenCalledTimes(1);
    expect(harness.onComplete).toHaveBeenCalledTimes(1);
  });
});

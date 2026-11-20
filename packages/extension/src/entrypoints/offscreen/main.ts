/**
 * Offscreen Document - Direct Video Downloader
 *
 * Runs outside the background service worker's idle lifecycle, downloads the
 * complete video file, and streams it to the VFS upload endpoint.
 */

const UPLOAD_URL = 'http://localhost:8766/upload';
const STALL_TIMEOUT_MS = 5 * 60 * 1000;

interface VideoJob {
  jobId: string;
  tabId: number;
  url: string;
  mimeType: string;
  size: number;
  maxBytes: number;
  capturedAt: string;
}

interface StartMessage {
  target: 'video-download';
  type: 'start';
  job: VideoJob;
}

interface AbortMessage {
  target: 'video-download';
  type: 'abort';
  jobId: string;
}

interface UploadResponse {
  hash: string;
  duplicate: boolean;
  size: number;
  mimeType?: string;
}

const controllers = new Map<string, AbortController>();
const runningJobs = new Set<string>();

function isVideoDownloadMessage(message: unknown): message is StartMessage | AbortMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { target?: unknown }).target === 'video-download'
  );
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isVideoDownloadMessage(message)) return false;

  if (message.type === 'abort') {
    controllers.get(message.jobId)?.abort();
    sendResponse({ accepted: true });
    return false;
  }

  // Ignore duplicate start messages caused by a retried send.
  if (runningJobs.has(message.job.jobId)) {
    sendResponse({ accepted: true });
    return false;
  }

  runningJobs.add(message.job.jobId);
  void downloadAndUpload(message.job).finally(() => {
    runningJobs.delete(message.job.jobId);
  });
  sendResponse({ accepted: true });
  return false;
});

async function downloadAndUpload(job: VideoJob): Promise<void> {
  const controller = new AbortController();
  controllers.set(job.jobId, controller);

  try {
    const result = await runDownload(job, controller);
    await reportResult({
      jobId: job.jobId,
      tabId: job.tabId,
      url: job.url,
      capturedAt: job.capturedAt,
      ...result,
    });
  } catch (error) {
    console.error('[OffscreenDownloader] Download failed:', job.url, error);
    const message = error instanceof Error ? error.message : 'Video download failed';
    await reportResult({
      jobId: job.jobId,
      tabId: job.tabId,
      url: job.url,
      capturedAt: job.capturedAt,
      error: message,
    });
  } finally {
    controllers.delete(job.jobId);
  }
}

async function runDownload(job: VideoJob, controller: AbortController): Promise<UploadResponse> {
  let stallTimer: ReturnType<typeof setTimeout> | null = null;

  const resetStallTimer = () => {
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      controller.abort(new Error('Video download stalled'));
    }, STALL_TIMEOUT_MS);
  };

  try {
    resetStallTimer();

    const response = await fetchVideoResponse(job, controller);
    const mimeType = resolveVideoMimeType(response, job);

    let received = 0;
    const meter = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, streamController) {
        received += chunk.byteLength;
        if (received > job.maxBytes) {
          streamController.error(new Error(`Video larger than ${job.maxBytes} bytes`));
          return;
        }
        resetStallTimer();
        streamController.enqueue(chunk);
      },
    });

    try {
      return await postUpload(response.body!.pipeThrough(meter), true, mimeType, job, controller);
    } catch (error) {
      // Some extension-page contexts reject streaming request bodies. Fall
      // back to a buffered upload before giving up.
      if (!(error instanceof TypeError)) throw error;

      console.warn(
        '[OffscreenDownloader] Streaming upload failed; retrying with a buffered body:',
        error
      );
      resetStallTimer();

      const retryResponse = await fetchVideoResponse(job, controller);
      const retryMimeType = resolveVideoMimeType(retryResponse, job);

      let buffer: ArrayBuffer;
      try {
        buffer = await retryResponse.arrayBuffer();
      } catch (bufferError) {
        throw new Error(`Buffered video fetch failed: ${describeError(bufferError)}`);
      }

      if (buffer.byteLength === 0) {
        throw new Error('Buffered video body is empty');
      }
      if (buffer.byteLength > job.maxBytes) {
        throw new Error(`Video larger than ${job.maxBytes} bytes`);
      }

      resetStallTimer();

      try {
        return await postUpload(buffer, false, retryMimeType, job, controller);
      } catch (fallbackError) {
        const hint = await probeVfs();
        throw new Error(
          `Upload failed (streaming: ${describeError(error)}; buffered: ${describeError(
            fallbackError
          )})${hint}`
        );
      }
    }
  } finally {
    if (stallTimer) clearTimeout(stallTimer);
  }
}

async function fetchVideoResponse(job: VideoJob, controller: AbortController): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(job.url, {
      signal: controller.signal,
      redirect: 'follow',
      credentials: 'omit',
      cache: 'no-store',
    });
  } catch (error) {
    throw new Error(`Video fetch failed: ${describeError(error)}`);
  }

  if (!response.ok) {
    throw new Error(`Video download failed with status ${response.status}`);
  }

  // The page's own request may have been a byte range, but this download
  // requested the whole resource. A 206 here means the server ignored that.
  if (response.status === 206) {
    throw new Error('Video download returned a partial response');
  }

  if (!response.body) {
    throw new Error('Video download returned an empty body');
  }

  return response;
}

function resolveVideoMimeType(response: Response, job: VideoJob): string {
  const headerMimeType = (response.headers.get('content-type') ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  const mimeType =
    headerMimeType && headerMimeType !== 'application/octet-stream' ? headerMimeType : job.mimeType;

  if (!mimeType.startsWith('video/')) {
    throw new Error(`Video download returned unsupported type ${mimeType || 'unknown'}`);
  }

  const declaredLength = Number.parseInt(response.headers.get('content-length') ?? '', 10);
  if (Number.isFinite(declaredLength) && declaredLength > job.maxBytes) {
    throw new Error(`Video larger than ${job.maxBytes} bytes`);
  }

  return mimeType;
}

async function postUpload(
  body: BodyInit,
  streaming: boolean,
  mimeType: string,
  job: VideoJob,
  controller: AbortController
): Promise<UploadResponse> {
  const response = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: {
      'Content-Type': mimeType,
      'X-Source-Url': job.url,
      'X-Captured-At': job.capturedAt,
    },
    body,
    signal: controller.signal,
    ...(streaming ? { duplex: 'half' } : {}),
  } as RequestInit & { duplex?: 'half' });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`VFS rejected upload (${response.status}): ${text}`);
  }

  const parsed = JSON.parse(text) as UploadResponse;
  return { ...parsed, mimeType: parsed.mimeType ?? mimeType };
}

function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

async function probeVfs(): Promise<string> {
  let health: string;
  try {
    const response = await fetch('http://localhost:8766/health', { cache: 'no-store' });
    health = response.ok ? 'health ok' : `health ${response.status}`;
  } catch {
    return ' (VFS service unreachable — is the rebuilt vfs-service running?)';
  }

  let options: string;
  try {
    const response = await fetch(UPLOAD_URL, { method: 'OPTIONS' });
    const methods = response.headers.get('access-control-allow-methods') ?? 'missing';
    options = `OPTIONS /upload ${response.status} (methods: ${methods})`;
  } catch (error) {
    options = `OPTIONS /upload failed: ${describeError(error)}`;
  }

  return ` (${health}; ${options})`;
}

async function reportResult(data: Record<string, unknown>): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: 'video-download:result', data });
  } catch (error) {
    console.warn('[OffscreenDownloader] Failed to report result:', error);
  }
}

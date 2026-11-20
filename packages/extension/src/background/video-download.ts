/**
 * Extension Background - Direct Video Download Manager
 *
 * Queues detected video candidates, drives the offscreen downloader, and
 * integrates completed downloads into the existing capture pipeline.
 */

import type { VideoCandidate } from './debugger-capture';

const OFFSCREEN_URL = 'offscreen.html';
const MAX_CONCURRENT_DOWNLOADS = 2;
const OFFSCREEN_IDLE_TIMEOUT_MS = 60_000;

export interface VideoDownloadResult {
  jobId: string;
  tabId: number;
  url: string;
  capturedAt: string;
  hash?: string;
  duplicate?: boolean;
  size?: number;
  mimeType?: string;
  error?: string;
}

interface VideoDownloadDependencies {
  recordCaptured: (tabId: number, capturedAt: string) => void;
  recordFailed: (tabId: number, url: string, message: string) => void;
}

interface VideoJob extends VideoCandidate {
  jobId: string;
}

/**
 * Coordinates video downloads across the offscreen document.
 */
export class VideoDownloadManager {
  private queue: VideoJob[] = [];
  private active = new Map<string, VideoJob>();
  private completed = new Set<string>();
  private cancelled = new Set<string>();
  private readonly dependencies: VideoDownloadDependencies;
  private offscreenReady: Promise<void> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(dependencies: VideoDownloadDependencies) {
    this.dependencies = dependencies;
  }

  /**
   * Queue a detected video candidate.
   */
  enqueue(candidate: VideoCandidate): void {
    this.queue.push({ ...candidate, jobId: crypto.randomUUID() });
    void this.pump();
  }

  /**
   * Handle a completion message sent by the offscreen downloader.
   */
  handleResult(result: VideoDownloadResult): void {
    if (this.completed.has(result.jobId)) return;
    this.completed.add(result.jobId);

    const job = this.active.get(result.jobId);
    this.active.delete(result.jobId);

    // A cancelled job must not be recorded even if it completed first.
    if (this.cancelled.has(result.jobId)) {
      this.cancelled.delete(result.jobId);
      void this.pump();
      return;
    }

    const tabId = job?.tabId ?? result.tabId;
    const url = job?.url ?? result.url;

    if (result.error) {
      this.dependencies.recordFailed(tabId, url, result.error);
    } else if (result.hash && !result.duplicate) {
      // The app emits file:captured and auto-enqueues when it stores the
      // uploaded video; the extension only records local capture state.
      this.dependencies.recordCaptured(tabId, result.capturedAt);
    }

    void this.pump();
  }

  /**
   * Drop pending jobs for a tab and abort its active downloads.
   */
  cancelTab(tabId: number): void {
    this.queue = this.queue.filter((job) => job.tabId !== tabId);

    for (const [jobId, job] of this.active) {
      if (job.tabId !== tabId) continue;
      this.active.delete(jobId);
      this.cancelled.add(jobId);
      void this.sendToOffscreen({ type: 'abort', jobId }).catch((error) => {
        console.warn('[VideoDownload] Failed to abort download:', error);
      });
    }

    void this.pump();
  }

  /**
   * Close the offscreen document when nothing is queued or active.
   */
  closeIfIdle(): void {
    if (this.queue.length === 0 && this.active.size === 0) {
      void this.closeOffscreen();
    }
  }

  private async pump(): Promise<void> {
    this.clearIdleTimer();

    while (this.active.size < MAX_CONCURRENT_DOWNLOADS && this.queue.length > 0) {
      const job = this.queue.shift();
      if (!job) break;

      this.active.set(job.jobId, job);

      try {
        await this.ensureOffscreen();
        await this.sendToOffscreen({
          type: 'start',
          job: {
            jobId: job.jobId,
            tabId: job.tabId,
            url: job.url,
            mimeType: job.mimeType,
            size: job.size,
            maxBytes: job.maxBytes,
            capturedAt: job.capturedAt,
          },
        });
      } catch (error) {
        this.active.delete(job.jobId);
        const message = error instanceof Error ? error.message : 'Failed to start download';
        this.dependencies.recordFailed(job.tabId, job.url, message);
      }
    }

    if (this.active.size === 0 && this.queue.length === 0) {
      this.scheduleIdleClose();
    }
  }

  private async sendToOffscreen(message: Record<string, unknown>): Promise<{ accepted?: boolean }> {
    const payload = { target: 'video-download', ...message };
    let lastError: unknown;

    // The offscreen document's listener may not be registered yet immediately
    // after createDocument resolves.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return (await chrome.runtime.sendMessage(payload)) as { accepted?: boolean };
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Offscreen downloader did not respond');
  }

  private async ensureOffscreen(): Promise<void> {
    const offscreen = chrome.offscreen as unknown as {
      hasDocument?: () => Promise<boolean>;
    };
    if (offscreen.hasDocument && (await offscreen.hasDocument())) return;

    if (!this.offscreenReady) {
      this.offscreenReady = chrome.offscreen
        .createDocument({
          url: chrome.runtime.getURL(OFFSCREEN_URL),
          reasons: ['BLOBS' as chrome.offscreen.Reason],
          justification: 'Download detected videos and stream them to the local VFS service.',
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          // Another context may have created it concurrently.
          if (message.includes('single offscreen')) return;
          throw error;
        })
        .finally(() => {
          this.offscreenReady = null;
        });
    }

    await this.offscreenReady;
  }

  private scheduleIdleClose(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      this.closeIfIdle();
    }, OFFSCREEN_IDLE_TIMEOUT_MS);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private async closeOffscreen(): Promise<void> {
    try {
      await chrome.offscreen.closeDocument();
    } catch {
      // No offscreen document is open.
    }
  }
}

let videoDownloadManager: VideoDownloadManager | null = null;

export function initVideoDownloadManager(
  dependencies: VideoDownloadDependencies
): VideoDownloadManager {
  videoDownloadManager = new VideoDownloadManager(dependencies);
  return videoDownloadManager;
}

export function getVideoDownloadManager(): VideoDownloadManager {
  if (!videoDownloadManager) {
    throw new Error('Video download manager has not been initialized');
  }
  return videoDownloadManager;
}

export function getExistingVideoDownloadManager(): VideoDownloadManager | null {
  return videoDownloadManager;
}

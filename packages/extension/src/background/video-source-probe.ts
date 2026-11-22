/**
 * Extension Background - Page video source probe
 *
 * Buffered assembly prefers network-shape evidence, but still probes page
 * video elements when it needs source confirmation. The probe covers all
 * frames and shadow roots, reads both `src` and `currentSrc`, and records
 * whether a MediaSource object is attached.
 */

export type VideoSourceStatus = 'progressive' | 'mse' | 'unverified';

export interface ProbeVideoSource {
  src: string;
  currentSrc: string;
  hasSrcObject: boolean;
}

export interface VideoSourceProbeResult {
  status: VideoSourceStatus;
  sources: string[];
  hasSrcObject: boolean;
}

const CACHED_TTL_MS = 3000;
const UNVERIFIED_TTL_MS = 500;
const PROBE_TIMEOUT_MS = 1500;

interface CacheEntry {
  at: number;
  ttl: number;
  promise: Promise<VideoSourceProbeResult>;
}

const cache = new Map<number, CacheEntry>();
let navigationListenerAttached = false;

function ensureNavigationListener(): void {
  if (navigationListenerAttached) return;
  navigationListenerAttached = true;
  try {
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
      if (changeInfo.url || changeInfo.status === 'loading') {
        cache.delete(tabId);
      }
    });
    chrome.tabs.onRemoved.addListener((tabId) => {
      cache.delete(tabId);
    });
  } catch {
    // Tests or non-extension contexts may not provide chrome.tabs.
  }
}

function normalizeSources(input: ProbeVideoSource[] | string[]): ProbeVideoSource[] {
  return input.map((item) =>
    typeof item === 'string' ? { src: item, currentSrc: '', hasSrcObject: false } : item
  );
}

export function classifyVideoSources(input: ProbeVideoSource[] | string[]): VideoSourceProbeResult {
  const items = normalizeSources(input);
  const sources = new Set<string>();
  let hasSrcObject = false;
  let httpSourceCount = 0;
  let blobSourceCount = 0;

  for (const item of items) {
    if (item.hasSrcObject) hasSrcObject = true;
    for (const value of [item.src, item.currentSrc]) {
      if (!value) continue;
      sources.add(value);
      if (/^https?:/i.test(value)) httpSourceCount += 1;
      else if (value.startsWith('blob:') || value.startsWith('data:')) blobSourceCount += 1;
    }
  }

  const result = [...sources];
  if (httpSourceCount > 0) {
    return { status: 'progressive', sources: result, hasSrcObject };
  }
  if (blobSourceCount > 0 || hasSrcObject) {
    return { status: 'mse', sources: result, hasSrcObject };
  }
  return { status: 'unverified', sources: result, hasSrcObject };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Video source probe timed out')), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function executeProbe(tabId: number): Promise<VideoSourceProbeResult> {
  const results = await withTimeout(
    chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => {
        const found: Array<{ src: string; currentSrc: string; hasSrcObject: boolean }> = [];

        const walk = (root: Document | ShadowRoot): void => {
          for (const element of Array.from(root.querySelectorAll('*'))) {
            if (element instanceof HTMLVideoElement) {
              found.push({
                src: element.src || '',
                currentSrc: element.currentSrc || '',
                hasSrcObject: Boolean(element.srcObject),
              });
              for (const source of Array.from(element.querySelectorAll('source'))) {
                found.push({ src: source.src || '', currentSrc: '', hasSrcObject: false });
              }
            }
            const shadowRoot = (element as HTMLElement).shadowRoot;
            if (shadowRoot) walk(shadowRoot);
          }
        };

        walk(document);
        return found;
      },
    }),
    PROBE_TIMEOUT_MS
  );

  const collected: ProbeVideoSource[] = [];
  for (const entry of results) {
    const result = entry?.result;
    if (!Array.isArray(result)) continue;
    for (const item of result as ProbeVideoSource[]) {
      if (typeof item?.src !== 'string' && typeof item?.currentSrc !== 'string') continue;
      collected.push({
        src: typeof item.src === 'string' ? item.src : '',
        currentSrc: typeof item.currentSrc === 'string' ? item.currentSrc : '',
        hasSrcObject: item.hasSrcObject === true,
      });
    }
  }

  return classifyVideoSources(collected);
}

export async function probeVideoSources(tabId: number): Promise<VideoSourceProbeResult> {
  ensureNavigationListener();

  const cached = cache.get(tabId);
  if (cached && Date.now() - cached.at < cached.ttl) {
    return cached.promise;
  }

  const promise = executeProbe(tabId).catch(() => ({
    status: 'unverified' as const,
    sources: [],
    hasSrcObject: false,
  }));

  // Cache immediately so concurrent responses share one probe. Update the TTL
  // once we know whether the result is worth keeping for longer.
  const entry: CacheEntry = { at: Date.now(), ttl: CACHED_TTL_MS, promise };
  cache.set(tabId, entry);
  void promise.then((result) => {
    if (cache.get(tabId) !== entry) return;
    entry.at = Date.now();
    entry.ttl = result.status === 'unverified' ? UNVERIFIED_TTL_MS : CACHED_TTL_MS;
  });

  return promise;
}

export function clearVideoSourceProbe(tabId?: number): void {
  if (tabId === undefined) {
    cache.clear();
    return;
  }
  cache.delete(tabId);
}

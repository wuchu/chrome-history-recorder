import type { PromptTemplates } from './prompt-templates';

export type { PromptTemplates };

/**
 * Tag definition for user-defined and system tags
 */
export interface TagDefinition {
  id: string;
  name: string;
  label: string;
  isSystem: boolean;
  sortOrder: number;
}

/**
 * Video capture configuration bounds and defaults.
 */
export const MIN_VIDEO_SIZE_LIMIT = 1 * 1024 * 1024;
export const MAX_VIDEO_SIZE_LIMIT = 2 * 1024 * 1024 * 1024;
export const DEFAULT_MAX_VIDEO_SIZE = 200 * 1024 * 1024;
export const DEFAULT_ENABLED_VIDEO_TYPES = ['video/mp4', 'video/webm'];

/**
 * Video MIME types this build can store and thumbnail.
 */
export const SUPPORTED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/ogg',
  'video/x-matroska',
];

export interface ExtensionConfig {
  ollamaEndpoint: string;
  visionModel?: string;
  language: string;
  promptTemplates?: PromptTemplates;
  ollamaMaxConcurrency: number;
  classifyConcurrency: number;
  renameConcurrency: number;
  classifyPaused: boolean;
  renamePaused: boolean;
  maxFileSize: number;
  captureVideos: boolean;
  maxVideoSize: number;
  enabledVideoTypes: string[];
  mediaArchiveEnabled: boolean;
  mediaArchiveTargetPath: string;
  mediaArchiveIntervalMinutes: number;
  mediaArchiveConcurrency: number;
}

/**
 * Default configuration used when the app has not provided a mirror yet.
 */
export const DEFAULT_EXTENSION_CONFIG: ExtensionConfig = {
  ollamaEndpoint: 'http://localhost:11434',
  language: 'zh-CN',
  ollamaMaxConcurrency: 1,
  classifyConcurrency: 1,
  renameConcurrency: 1,
  classifyPaused: true,
  renamePaused: true,
  maxFileSize: 50 * 1024 * 1024,
  captureVideos: true,
  maxVideoSize: DEFAULT_MAX_VIDEO_SIZE,
  enabledVideoTypes: [...DEFAULT_ENABLED_VIDEO_TYPES],
  mediaArchiveEnabled: false,
  mediaArchiveTargetPath: '',
  mediaArchiveIntervalMinutes: 5,
  mediaArchiveConcurrency: 1,
};

export interface OllamaModel {
  name: string;
  modifiedAt?: string;
  size?: number;
  family?: string;
  parameterSize?: string;
  quantizationLevel?: string;
}

export interface SchedulerTaskTypeStatus {
  state: 'running' | 'paused';
  processing: number;
  concurrency: number;
}

export interface SchedulerStatus {
  state: 'running' | 'paused';
  running: boolean;
  processing: number;
  byType: Record<string, SchedulerTaskTypeStatus>;
}

/**
 * Workspace path state reported by the app.
 */
export interface WorkspaceConfigInfo {
  path: string;
  defaultPath: string;
  source: 'cli' | 'env' | 'config' | 'default';
  pendingPath?: string;
}

export interface WorkspacePathUpdateResult {
  success: boolean;
  restartRequired: boolean;
  pendingPath: string;
}

/**
 * Media archive state reported by the app.
 */
export interface MediaArchiveStatus {
  enabled: boolean;
  targetPath: string;
  intervalMinutes: number;
  concurrency: number;
  running: boolean;
  lastRunAt?: string;
  pendingCount: number;
  failedCount: number;
  lastError?: string;
}

export interface MediaArchiveConfigUpdate {
  enabled?: boolean;
  targetPath?: string;
  intervalMinutes?: number;
  concurrency?: number;
}

export type TaskType = 'classify' | 'rename' | (string & {});

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

export interface TaskItem {
  id: number;
  task_type: TaskType;
  target_hash: string;
  status: TaskStatus;
  priority: number;
  attempts: number;
  max_attempts: number;
  next_run_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskTypeSummary {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  skipped: number;
  total: number;
}

export interface QueueStatus extends TaskTypeSummary {
  scheduler?: SchedulerStatus;
  byType?: Record<string, TaskTypeSummary>;
}

/**
 * AI-owned tag vocabulary record.
 */
export interface VFSTagRecord {
  id: number;
  name: string;
  label: string | null;
  usage_count: number;
  created_by: string;
  is_pinned: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceStatus {
  vfsConnected: boolean;
  ollamaAvailable: boolean;
}

/**
 * Capture session contracts.
 *
 * A session belongs to one browser tab and is global to the extension: at most
 * one session may be capturing at a time.
 */
export type CaptureSessionStatus = 'capturing' | 'stopped' | 'error';

export type SessionAiStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

export type SessionEventKind =
  | 'saved'
  | 'duplicate'
  | 'skipped'
  | 'failed'
  | 'video:candidate'
  | 'video:result'
  | 'ai';

export interface SessionCounters {
  saved: number;
  duplicate: number;
  skipped: number;
  failed: number;
  bytesSaved: number;
  imagesSaved: number;
  videosSaved: number;
  aiPending: number;
  aiProcessing: number;
  aiCompleted: number;
  aiFailed: number;
  aiSkipped: number;
  videosQueued: number;
  videosDownloading: number;
}

export interface SessionMediaItem {
  hash: string;
  mimeType: string;
  size: number;
  sourceUrl?: string;
  capturedAt: string;
  aiStatus?: SessionAiStatus;
  duplicate?: boolean;
}

export interface SessionEvent {
  id: string;
  sessionId: string;
  tabId: number;
  pageUrl: string;
  kind: SessionEventKind;
  timestamp: string;
  hash?: string;
  mimeType?: string;
  size?: number;
  sourceUrl?: string;
  reason?: string;
  error?: string;
  aiStatus?: SessionAiStatus;
  duplicate?: boolean;
}

export interface SessionEventInput {
  kind: SessionEventKind;
  hash?: string;
  mimeType?: string;
  size?: number;
  sourceUrl?: string;
  reason?: string;
  error?: string;
  aiStatus?: SessionAiStatus;
  timestamp?: string;
  pageUrl?: string;
  duplicate?: boolean;
}

export interface SessionTopReason {
  reason: string;
  count: number;
}

export interface SessionSummary {
  sessionId: string;
  tabId: number;
  tabTitle: string;
  pageUrl: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  counters: SessionCounters;
  topReasons: SessionTopReason[];
  error?: string;
}

export interface CaptureSession {
  id: string;
  tabId: number;
  windowId?: number;
  tabTitle: string;
  pageUrl: string;
  origin: string;
  startedAt: string;
  endedAt?: string;
  status: CaptureSessionStatus;
  error?: string;
  counters: SessionCounters;
  recentItems: SessionMediaItem[];
  events: SessionEvent[];
  savedHashes: string[];
  aiStatuses: Record<string, SessionAiStatus>;
}

export interface CaptureSessionSnapshot {
  session: CaptureSession | null;
  summary: SessionSummary | null;
}

export interface CaptureStateData {
  tabId: number;
  isEnabled: boolean;
  status: 'idle' | 'capturing' | 'error';
  debuggerAttached: boolean;
  captureCount: number;
  skippedCount: number;
  failedCount: number;
  lastCaptureTime?: string;
  error?: string;
}

export interface MediaStats {
  totalFiles: number;
  totalSize: number;
  images: number;
  videos: number;
  byCategory: Record<string, number>;
}

export async function getCaptureSession(): Promise<CaptureSessionSnapshot> {
  return sendRuntimeMessage<CaptureSessionSnapshot>({ type: 'capture:get-session' });
}

export async function clearCaptureSessionLog(): Promise<void> {
  await sendRuntimeMessage<void>({ type: 'capture:clear-log' });
}

export async function getCaptureState(tabId: number): Promise<CaptureStateData> {
  return sendRuntimeMessage<CaptureStateData>({ type: 'capture:get-state', tabId });
}

export async function startCapture(tabId: number): Promise<CaptureStateData> {
  return sendRuntimeMessage<CaptureStateData>({ type: 'capture:start', tabId });
}

export async function stopCapture(tabId: number): Promise<CaptureStateData> {
  return sendRuntimeMessage<CaptureStateData>({ type: 'capture:stop', tabId });
}

export async function getMediaStats(): Promise<MediaStats> {
  return sendRuntimeMessage<MediaStats>({ type: 'getStats' });
}

export interface SyncBlobsToIndexResult {
  scanned: number;
  indexed: number;
  skippedExisting: number;
  skippedUnsupported: number;
  skippedInvalidHash: number;
  errors: Array<{ path: string; reason: string }>;
}

interface RuntimeResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
  [key: string]: unknown;
}

async function sendRuntimeMessage<T>(message: Record<string, unknown>): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as
    | RuntimeResponse<T>
    | T
    | undefined;
  if (!response) {
    throw new Error('No response from extension background');
  }

  const maybeWrapped = response as RuntimeResponse<T>;
  if (maybeWrapped.success === false) {
    throw new Error(maybeWrapped.error ?? 'Background request failed');
  }

  return (maybeWrapped.data ?? response) as T;
}

export async function getConfig(): Promise<ExtensionConfig> {
  return sendRuntimeMessage<ExtensionConfig>({ type: 'getConfig' });
}

export async function updateConfig(updates: Partial<ExtensionConfig>): Promise<void> {
  await sendRuntimeMessage<void>({ type: 'updateConfig', updates });
}

export async function getWorkspaceConfig(): Promise<WorkspaceConfigInfo> {
  return sendRuntimeMessage<WorkspaceConfigInfo>({ type: 'getWorkspaceConfig' });
}

export async function setWorkspacePath(path: string): Promise<WorkspacePathUpdateResult> {
  return sendRuntimeMessage<WorkspacePathUpdateResult>({ type: 'setWorkspacePath', path });
}

export async function getMediaArchiveStatus(): Promise<MediaArchiveStatus> {
  return sendRuntimeMessage<MediaArchiveStatus>({ type: 'getMediaArchiveStatus' });
}

export async function updateMediaArchiveConfig(
  update: MediaArchiveConfigUpdate
): Promise<MediaArchiveStatus> {
  return sendRuntimeMessage<MediaArchiveStatus>({ type: 'updateMediaArchiveConfig', ...update });
}

export async function runMediaArchiveNow(): Promise<MediaArchiveStatus> {
  return sendRuntimeMessage<MediaArchiveStatus>({ type: 'runMediaArchiveNow' });
}

export async function listOllamaModels(): Promise<{
  models: OllamaModel[];
  selectedModel?: string;
  changed?: boolean;
}> {
  return sendRuntimeMessage<{ models: OllamaModel[]; selectedModel?: string; changed?: boolean }>({
    type: 'listOllamaModels',
  });
}

export async function checkOllamaHealth(): Promise<boolean> {
  const response = (await chrome.runtime.sendMessage({ type: 'checkOllamaHealth' })) as
    | { available?: boolean }
    | undefined;
  return Boolean(response?.available);
}

export async function isVFSConnected(): Promise<boolean> {
  const response = (await chrome.runtime.sendMessage({ type: 'isVFSConnected' })) as
    | { connected?: boolean }
    | undefined;
  return Boolean(response?.connected);
}

export async function reconnectVFS(): Promise<void> {
  await sendRuntimeMessage<void>({ type: 'reconnectVFS' });
}

export async function syncBlobsToIndex(): Promise<SyncBlobsToIndexResult> {
  return sendRuntimeMessage<SyncBlobsToIndexResult>({ type: 'syncBlobsToIndex' });
}

export async function getQueueStatus(): Promise<QueueStatus> {
  return sendRuntimeMessage<QueueStatus>({ type: 'getQueueStatus' });
}

export async function startClassification(): Promise<SchedulerStatus> {
  return sendRuntimeMessage<SchedulerStatus>({ type: 'startClassification' });
}

export async function pauseClassification(): Promise<SchedulerStatus> {
  return sendRuntimeMessage<SchedulerStatus>({ type: 'pauseClassification' });
}

export async function setTaskPaused(taskType: TaskType, paused: boolean): Promise<SchedulerStatus> {
  return sendRuntimeMessage<SchedulerStatus>({ type: 'setTaskPaused', taskType, paused });
}

export async function retryFailedTasks(taskType?: TaskType): Promise<{ count: number }> {
  return sendRuntimeMessage<{ count: number }>({ type: 'retryFailedTasks', taskType });
}

export async function clearQueue(taskType?: TaskType): Promise<void> {
  await sendRuntimeMessage<void>({ type: 'clearQueue', taskType });
}

/**
 * Requeue a single task type for one hash (manual single-file refresh).
 *
 * A `skipped` result means the media is not applicable to the AI pipeline;
 * `reason` carries the user-facing explanation.
 */
export async function refreshTask(
  taskType: TaskType,
  hash: string
): Promise<{ success: boolean; skipped?: boolean; reason?: string }> {
  const result = await sendRuntimeMessage<{
    success: boolean;
    skipped?: boolean;
    reason?: string;
  }>({
    type: 'requeueTask',
    taskType,
    hash,
  });
  return {
    success: Boolean(result?.success),
    skipped: Boolean(result?.skipped),
    reason: result?.reason,
  };
}

/**
 * Requeue every media item for the given task types (full rescan).
 */
export async function refreshAllTasks(taskTypes: TaskType[]): Promise<number> {
  const result = await sendRuntimeMessage<{ count: number }>({
    type: 'requeueAllTasks',
    taskTypes,
  });
  return result?.count ?? 0;
}

export async function getTasksByHash(hash: string): Promise<TaskItem[]> {
  return sendRuntimeMessage<TaskItem[]>({ type: 'getTasksByHash', hash });
}

export async function listTags(
  options: {
    limit?: number;
    pinnedOnly?: boolean;
  } = {}
): Promise<VFSTagRecord[]> {
  return sendRuntimeMessage<VFSTagRecord[]>({ type: 'listTags', ...options });
}

export async function getTagVocabulary(limit?: number): Promise<string[]> {
  return sendRuntimeMessage<string[]>({ type: 'getTagVocabulary', limit });
}

export async function renameTag(id: number, name: string, label?: string): Promise<VFSTagRecord> {
  return sendRuntimeMessage<VFSTagRecord>({ type: 'renameTag', id, name, label });
}

export async function mergeTags(sourceId: number, targetId: number): Promise<VFSTagRecord> {
  return sendRuntimeMessage<VFSTagRecord>({ type: 'mergeTags', sourceId, targetId });
}

export async function deleteTag(id: number): Promise<boolean> {
  const result = await sendRuntimeMessage<{ success: boolean }>({ type: 'deleteTag', id });
  return Boolean(result?.success);
}

export async function setTagPinned(id: number, pinned: boolean): Promise<VFSTagRecord | null> {
  return sendRuntimeMessage<VFSTagRecord | null>({ type: 'setTagPinned', id, pinned });
}

export interface TagCounts {
  all: number;
  [tag: string]: number;
}

export interface MediaListQuery {
  category?: string;
  tag?: string;
  q?: string;
  terms?: string[];
  excludeTerms?: string[];
  mimeType?: 'image' | 'video';
  sourceDomain?: string;
  sourceDomains?: string[];
  capturedFrom?: string;
  capturedTo?: string;
  starred?: boolean;
  classifyStatus?: TaskStatus;
  tags?: string[];
  tagMode?: 'and' | 'or';
  tagGroups?: string[][];
  limit?: number;
  offset?: number;
  cursor?: string;
  orderBy?:
    | 'captured_at'
    | 'size'
    | 'confidence'
    | 'ai_filename'
    | 'category'
    | 'classified_at'
    | 'deleted_at';
  order?: 'asc' | 'desc';
  status?: 'active' | 'trashed' | 'all';
}

export interface MediaListResult<T = unknown> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface SourceDomainCount {
  domain: string;
  count: number;
}

export async function listMediaFiles<T = unknown>(
  query: MediaListQuery = {}
): Promise<MediaListResult<T>> {
  return sendRuntimeMessage<MediaListResult<T>>({ type: 'listFiles', query });
}

export async function getSourceDomains(limit = 100): Promise<SourceDomainCount[]> {
  return sendRuntimeMessage<SourceDomainCount[]>({ type: 'getSourceDomains', limit });
}

export async function setFileStarred<T = unknown>(hash: string, starred: boolean): Promise<T> {
  return sendRuntimeMessage<T>({ type: 'setFileStarred', hash, starred });
}

export async function updateFileNotes<T = unknown>(hash: string, notes: string): Promise<T> {
  return sendRuntimeMessage<T>({ type: 'updateFileNotes', hash, notes });
}

export async function addFileTags(hash: string, tags: string[]): Promise<{ tags: string[] }> {
  return sendRuntimeMessage<{ tags: string[] }>({ type: 'addFileTags', hash, tags });
}

export async function removeFileTags(hash: string, tags: string[]): Promise<{ tags: string[] }> {
  return sendRuntimeMessage<{ tags: string[] }>({ type: 'removeFileTags', hash, tags });
}

export async function getTagCounts(): Promise<TagCounts> {
  return sendRuntimeMessage<TagCounts>({ type: 'getTagCounts' });
}

export async function loadServiceStatus(): Promise<ServiceStatus> {
  const [vfsConnected, ollamaAvailable] = await Promise.all([
    isVFSConnected(),
    checkOllamaHealth(),
  ]);
  return { vfsConnected, ollamaAvailable };
}

export async function clearIndex(): Promise<{ success: boolean }> {
  return sendRuntimeMessage<{ success: boolean }>({ type: 'clearIndex' });
}

/**
 * One-shot capture (right-click save / page scan).
 */
export type OneShotCandidateKind = 'img' | 'background' | 'poster';

export interface OneShotMediaCandidate {
  id: string;
  kind: OneShotCandidateKind;
  url: string;
  pageUrl: string;
  width?: number;
  height?: number;
  mimeHint?: string;
  sizeHint?: number;
  label?: string;
}

export interface PageScanResult {
  candidates: OneShotMediaCandidate[];
  totalFound: number;
  skippedSmall: number;
  skippedSvg: number;
  skippedIframes: number;
  capped: number;
}

export type OneShotErrorCode =
  | 'fetch-failed'
  | 'unsupported-mime'
  | 'too-large'
  | 'too-small'
  | 'expired-blob'
  | 'restricted-page'
  | 'vfs-disconnected'
  | 'timeout'
  | 'decode-failed'
  | 'unknown';

export interface OneShotSaveResult {
  candidateId: string;
  hash?: string;
  duplicate: boolean;
  saved: boolean;
  skipped?: boolean;
  errorCode?: OneShotErrorCode;
  error?: string;
}

export async function scanPageMedia(tabId: number): Promise<PageScanResult> {
  return sendRuntimeMessage<PageScanResult>({ type: 'capture:scan-page', tabId });
}

export async function saveOneShotCandidate(
  tabId: number,
  candidate: OneShotMediaCandidate
): Promise<OneShotSaveResult> {
  return sendRuntimeMessage<OneShotSaveResult>({
    type: 'capture:save-candidate',
    tabId,
    candidate,
  });
}

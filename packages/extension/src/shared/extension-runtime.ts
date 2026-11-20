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
  classificationConcurrency: number;
  classificationPaused: boolean;
  maxFileSize: number;
  captureVideos: boolean;
  maxVideoSize: number;
  enabledVideoTypes: string[];
}

/**
 * Default configuration used when the app has not provided a mirror yet.
 */
export const DEFAULT_EXTENSION_CONFIG: ExtensionConfig = {
  ollamaEndpoint: 'http://localhost:11434',
  language: 'zh-CN',
  classificationConcurrency: 1,
  classificationPaused: true,
  maxFileSize: 50 * 1024 * 1024,
  captureVideos: true,
  maxVideoSize: DEFAULT_MAX_VIDEO_SIZE,
  enabledVideoTypes: [...DEFAULT_ENABLED_VIDEO_TYPES],
};

export interface OllamaModel {
  name: string;
  modifiedAt?: string;
  size?: number;
  family?: string;
  parameterSize?: string;
  quantizationLevel?: string;
}

export interface SchedulerStatus {
  state: 'running' | 'paused';
  running: boolean;
  processing: number;
  concurrency: number;
}

export type TaskType = 'classify' | 'rename' | (string & {});

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

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

export async function retryFailedTasks(taskType?: TaskType): Promise<{ count: number }> {
  return sendRuntimeMessage<{ count: number }>({ type: 'retryFailedTasks', taskType });
}

export async function clearQueue(taskType?: TaskType): Promise<void> {
  await sendRuntimeMessage<void>({ type: 'clearQueue', taskType });
}

/**
 * Requeue a single task type for one hash (manual single-file refresh).
 */
export async function refreshTask(taskType: TaskType, hash: string): Promise<boolean> {
  const result = await sendRuntimeMessage<{ success: boolean }>({
    type: 'requeueTask',
    taskType,
    hash,
  });
  return Boolean(result?.success);
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

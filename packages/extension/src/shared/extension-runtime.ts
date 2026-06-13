export type FilenameStyle =
  | 'auto'
  | 'fun'
  | 'sexy'
  | 'artistic'
  | 'poetic'
  | 'minimal'
  | 'professional'
  | 'narrative';

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

export interface ExtensionConfig {
  ollamaEndpoint: string;
  visionModel?: string;
  language: string;
  filenameStyle: FilenameStyle;
  filenameStylePrompt?: string;
  classificationConcurrency: number;
  classificationPaused: boolean;
  maxFileSize: number;
  userDefinedTags: TagDefinition[];
}

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

export interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  scheduler?: SchedulerStatus;
}

export interface ServiceStatus {
  vfsConnected: boolean;
  ollamaAvailable: boolean;
}

interface RuntimeResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
  [key: string]: unknown;
}

async function sendRuntimeMessage<T>(message: Record<string, unknown>): Promise<T> {
  const response = await chrome.runtime.sendMessage(message) as RuntimeResponse<T> | T | undefined;
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

export async function listOllamaModels(): Promise<{ models: OllamaModel[]; selectedModel?: string; changed?: boolean }> {
  return sendRuntimeMessage<{ models: OllamaModel[]; selectedModel?: string; changed?: boolean }>({
    type: 'listOllamaModels',
  });
}

export async function checkOllamaHealth(): Promise<boolean> {
  const response = await chrome.runtime.sendMessage({ type: 'checkOllamaHealth' }) as { available?: boolean } | undefined;
  return Boolean(response?.available);
}

export async function isVFSConnected(): Promise<boolean> {
  const response = await chrome.runtime.sendMessage({ type: 'isVFSConnected' }) as { connected?: boolean } | undefined;
  return Boolean(response?.connected);
}

export async function reconnectVFS(): Promise<void> {
  await sendRuntimeMessage<void>({ type: 'reconnectVFS' });
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

export async function retryFailedTasks(): Promise<{ count: number }> {
  return sendRuntimeMessage<{ count: number }>({ type: 'retryFailedTasks' });
}

export async function clearQueue(): Promise<void> {
  await sendRuntimeMessage<void>({ type: 'clearQueue' });
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

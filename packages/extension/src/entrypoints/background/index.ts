/**
 * Extension Background Service Worker
 *
 * Thin UX layer: CDP capture, video download orchestration, a WebSocket
 * relay, a configuration mirror, and UI messaging. The app backend owns
 * storage, AI, scheduling, and the configuration source of truth.
 */

import { defineBackground } from 'wxt/utils/define-background';
import { initVFSWebSocketClient, getVFSWebSocketClient } from '../../background/vfs-ws-client';
import { initFileManager, getFileManager } from '../../background/file-manager';
import {
  initDebuggerCaptureController,
  getDebuggerCaptureController,
  getExistingDebuggerCaptureController,
} from '../../background/debugger-capture';
import {
  initVideoDownloadManager,
  getVideoDownloadManager,
  type VideoDownloadResult,
} from '../../background/video-download';
import { initCaptureSessionStore, getCaptureSessionStore } from '../../background/capture-session';
import type { SessionAiStatus } from '../../shared/extension-runtime';
import { DEFAULT_EXTENSION_CONFIG, type ExtensionConfig } from '../../shared/extension-runtime';

export default defineBackground(() => {
  console.log('[Media Extension] Background service worker starting...');

  // Open the side panel when the toolbar icon is clicked.
  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error: unknown) => {
      console.warn('[Media Extension] Failed to configure side panel behavior:', error);
    });
  }

  let mirroredConfig: ExtensionConfig = {
    ...DEFAULT_EXTENSION_CONFIG,
    enabledVideoTypes: [...DEFAULT_EXTENSION_CONFIG.enabledVideoTypes],
  };
  let initializationPromise: Promise<void> | null = null;

  /**
   * Correlate global AI events to the active session by hash.
   */
  function recordSessionAiEvent(event: string, data: unknown): void {
    const payload = data as { hash?: string; task_type?: string; error?: string } | null;
    const hash = payload?.hash;
    if (!hash) return;

    let status: SessionAiStatus | null = null;
    switch (event) {
      case 'classify:queued':
        status = 'pending';
        break;
      case 'classify:started':
        status = 'processing';
        break;
      case 'classify:complete':
      case 'file:classified':
        status = 'completed';
        break;
      case 'classify:failed':
        status = 'failed';
        break;
      case 'task:queued':
        if (payload?.task_type === 'classify') status = 'pending';
        break;
      case 'task:started':
        if (payload?.task_type === 'classify') status = 'processing';
        break;
      case 'task:completed':
        if (payload?.task_type === 'classify') status = 'completed';
        break;
      case 'task:failed':
        if (payload?.task_type === 'classify') status = 'failed';
        break;
      default:
        return;
    }

    if (!status) return;
    const store = getCaptureSessionStore();
    store.recordAiStatus(hash, status, { error: payload?.error });
  }

  /**
   * Update the local configuration mirror and the capture controller.
   * The app remains the source of truth; this mirror lets capture start
   * before the first app round-trip completes.
   */
  function applyConfigMirror(config: Partial<ExtensionConfig>, persist: boolean): void {
    mirroredConfig = {
      ...mirroredConfig,
      ...config,
      enabledVideoTypes: [...(config.enabledVideoTypes ?? mirroredConfig.enabledVideoTypes)],
    };
    getExistingDebuggerCaptureController()?.updateConfig(mirroredConfig);
    if (persist) {
      void chrome.storage.local.set({ vfsConfig: mirroredConfig });
    }
  }

  /**
   * Pull configuration from the app, migrating legacy chrome.storage config
   * once. Failures keep the current mirror and are logged without blocking
   * capture.
   */
  async function syncConfig(
    client: ReturnType<typeof getVFSWebSocketClient>,
    migrate: boolean
  ): Promise<void> {
    try {
      if (migrate) {
        const stored = await chrome.storage.local.get(['vfsConfig', 'configMigrationDone']);
        if (!stored.configMigrationDone && stored.vfsConfig) {
          try {
            await client.migrateConfig(stored.vfsConfig as Partial<ExtensionConfig>);
            await chrome.storage.local.set({ configMigrationDone: true });
          } catch (error) {
            // Leave the flag unset so the next connection retries.
            console.warn('[Media Extension] Config migration failed:', error);
          }
        }
      }

      const config = await client.getConfig();
      applyConfigMirror(config, true);
    } catch (error) {
      console.warn('[Media Extension] Failed to sync config from app:', error);
    }
  }

  async function initialize(): Promise<void> {
    console.log('[Media Extension] ========== STARTING INITIALIZATION ==========');

    try {
      const vfsWsClient = initVFSWebSocketClient();
      initFileManager();

      const sessionStore = initCaptureSessionStore({
        onChange: (snapshot) => {
          getFileManager().broadcastEvent('capture:session', snapshot);
        },
      });
      await sessionStore.restore();

      let restoredAttachedTabId: number | null = null;
      const restoredSession = sessionStore.getActiveSession();
      if (restoredSession) {
        try {
          const targets = await chrome.debugger.getTargets();
          const attached = targets.some(
            (target) => target.tabId === restoredSession.tabId && target.attached
          );
          if (attached) {
            restoredAttachedTabId = restoredSession.tabId;
          } else {
            sessionStore.end(
              'error',
              'Capture stopped because the debugger was no longer attached'
            );
          }
        } catch {
          // Debugger target lookup is best-effort; keep the restored snapshot.
        }
      }

      const connectionPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('App WebSocket connection timeout'));
        }, 10000);

        vfsWsClient.onConnect(() => {
          clearTimeout(timeout);
          resolve();
        });

        if (vfsWsClient.isConnected()) {
          clearTimeout(timeout);
          resolve();
        }
      });

      try {
        await connectionPromise;
        console.log('[Media Extension] App WebSocket connected');
        // The server's connected event may have arrived before listeners were
        // registered; make sure the UI sees the connected state.
        getFileManager().broadcastEvent('vfs:connected', {});
      } catch {
        console.warn('[Media Extension] App not connected yet; will reconnect');
        getFileManager().broadcastEvent('vfs:disconnected', { error: 'Connection timeout' });
      }

      // Relay app-originated events to UI panels, and keep the config mirror
      // current when the app broadcasts a configuration change.
      vfsWsClient.onEvent((event, data) => {
        if (event === 'config:updated') {
          applyConfigMirror(data as ExtensionConfig, true);
        }
        recordSessionAiEvent(event, data);
        getFileManager().broadcastEvent(event, data);
      });

      await syncConfig(vfsWsClient, true);
      vfsWsClient.onConnect(() => {
        void syncConfig(vfsWsClient, true);
      });

      initVideoDownloadManager({
        recordCaptured: (tabId, capturedAt) =>
          getDebuggerCaptureController().recordVideoCaptured(tabId, capturedAt),
        recordFailed: (tabId, url, message) =>
          getDebuggerCaptureController().recordVideoFailed(tabId, url, message),
        recordDownloadStarted: (tabId) => {
          const store = getCaptureSessionStore();
          if (store.getActiveSession()?.tabId === tabId) {
            store.recordVideoDownloadStarted();
          }
        },
        recordDownloadCancelled: (tabId) => {
          const store = getCaptureSessionStore();
          if (store.getActiveSession()?.tabId === tabId) {
            store.recordVideoDownloadCancelled();
          }
        },
        recordResult: (result) => {
          const store = getCaptureSessionStore();
          if (store.getActiveSession()?.tabId !== result.tabId) return;
          store.recordVideoResult({
            hash: result.hash,
            mimeType: result.mimeType,
            size: result.size,
            url: result.url,
            error: result.error,
            duplicate: result.duplicate,
            pageUrl: result.pageUrl,
          });
        },
      });

      initDebuggerCaptureController(
        {
          getFileManager,
          onVideoCandidate: (candidate) => {
            const store = getCaptureSessionStore();
            if (store.getActiveSession()?.tabId === candidate.tabId) {
              store.recordVideoCandidate({
                url: candidate.url,
                mimeType: candidate.mimeType,
                size: candidate.size,
                pageUrl: candidate.pageUrl,
              });
            }
            getVideoDownloadManager().enqueue(candidate);
          },
        },
        {
          captureVideos: mirroredConfig.captureVideos,
          maxVideoSize: mirroredConfig.maxVideoSize,
          enabledVideoTypes: mirroredConfig.enabledVideoTypes,
        }
      );

      if (restoredAttachedTabId !== null) {
        getDebuggerCaptureController().restoreActiveSession(restoredAttachedTabId);
      }

      // Remove the retired Ollama DNR rule if an older version installed it.
      try {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: [11434],
        });
      } catch {
        // DNR unavailable or no rule to remove.
      }

      console.log('[Media Extension] ========== INITIALIZATION COMPLETE ==========');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Media Extension] Initialization failed:', message);
    }
  }

  function ensureInitialized(): Promise<void> {
    if (!initializationPromise) {
      initializationPromise = initialize();
    }
    return initializationPromise;
  }

  // Start initialization eagerly.
  void ensureInitialized();

  // Handle messages from Content Scripts, Side Panel, Options, and Offscreen.
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      try {
        await ensureInitialized();

        const fileManager = getFileManager();
        const vfsWsClient = getVFSWebSocketClient();

        switch (message.type) {
          // File operations
          case 'capture:media': {
            const captureResult = await fileManager.handleCaptureMedia(message.data);
            // The app auto-enqueues AI tasks when it stores the file.
            sendResponse({ success: true, data: captureResult });
            break;
          }

          case 'listFiles':
          case 'list-files': {
            const listQuery = message.query ?? {
              limit: message.limit,
              offset: message.offset,
              category: message.category,
              tag: message.tag,
            };
            const listResult = await fileManager.handleListFiles(listQuery);
            sendResponse({ success: true, data: listResult, ...listResult });
            break;
          }

          case 'deleteFile': {
            const deleteResult = await fileManager.handleDeleteFile(message.hash, message.hard);
            sendResponse({ success: true, data: deleteResult });
            break;
          }

          case 'getStats': {
            const stats = await fileManager.getStats();
            sendResponse({ success: true, data: stats });
            break;
          }

          case 'syncBlobsToIndex': {
            const syncResult = await vfsWsClient.syncBlobsToIndex();
            sendResponse({ success: true, data: syncResult, ...syncResult });
            break;
          }

          case 'clearIndex': {
            const clearResult = await vfsWsClient.clearIndex();
            sendResponse({ ...clearResult, data: clearResult });
            break;
          }

          case 'getThumbnailUrl': {
            const thumbnailUrl = fileManager.getThumbnailUrl(message.hash, message.size);
            sendResponse({ success: true, data: { url: thumbnailUrl } });
            break;
          }

          // App configuration (source of truth in the backend)
          case 'getConfig':
          case 'get-config': {
            const config = await vfsWsClient.getConfig().catch(() => mirroredConfig);
            applyConfigMirror(config, true);
            sendResponse({ success: true, data: config, ...config });
            break;
          }

          case 'updateConfig': {
            const result = await vfsWsClient.updateConfig(message.updates);
            const config = result?.config ?? (await vfsWsClient.getConfig());
            applyConfigMirror(config, true);
            sendResponse({ success: true, data: config, ...config });
            break;
          }

          case 'resetConfig': {
            const result = await vfsWsClient.updateConfig(DEFAULT_EXTENSION_CONFIG);
            const config = result?.config ?? (await vfsWsClient.getConfig());
            applyConfigMirror(config, true);
            sendResponse({ success: true, data: config, ...config });
            break;
          }

          // Scheduler and queue (owned by the app)
          case 'getQueueStatus':
          case 'get-queue-status': {
            const queueStatus = await vfsWsClient.getQueueStatus();
            let schedulerStatus;
            try {
              schedulerStatus = await vfsWsClient.getSchedulerStatus();
            } catch {
              schedulerStatus = undefined;
            }
            sendResponse({
              success: true,
              data: { ...queueStatus, scheduler: schedulerStatus },
              ...queueStatus,
              scheduler: schedulerStatus,
            });
            break;
          }

          case 'enqueueClassification': {
            const result = await vfsWsClient.enqueueTask({
              taskType: 'classify',
              hash: message.hash,
              priority: message.priority,
            });
            sendResponse({ success: true, data: result });
            break;
          }

          case 'requeueClassification':
          case 'requeue-classification': {
            const result = await vfsWsClient.requeueTask('classify', message.hash);
            sendResponse({ success: result.success, data: result });
            break;
          }

          case 'requeueTask':
          case 'requeue-task': {
            const taskType = message.taskType ?? message.task_type;
            const result = await vfsWsClient.requeueTask(taskType, message.hash);
            sendResponse({ success: result.success, data: result });
            break;
          }

          case 'requeueAllTasks':
          case 'requeue-all-tasks': {
            const taskTypes: string[] = Array.isArray(message.taskTypes)
              ? message.taskTypes
              : message.taskType
                ? [message.taskType]
                : ['classify', 'rename'];
            let count = 0;
            for (const type of taskTypes) {
              const result = await vfsWsClient.requeueAll(type);
              count += result.count;
            }
            sendResponse({ success: true, data: { count }, count });
            break;
          }

          case 'getTasksByHash':
          case 'get-tasks-by-hash': {
            const tasks = await vfsWsClient.getTasksByHash(message.hash);
            sendResponse({ success: true, data: tasks, tasks });
            break;
          }

          case 'retryFailedTasks':
          case 'retry-failed-tasks': {
            const result = await vfsWsClient.retryFailedTasks(message.taskType);
            sendResponse({ success: true, data: result, count: result.count });
            break;
          }

          case 'clearQueue':
          case 'clear-queue': {
            await vfsWsClient.clearQueue(message.taskType);
            sendResponse({ success: true });
            break;
          }

          case 'startClassification':
          case 'start-classification': {
            const status = await vfsWsClient.startClassification();
            applyConfigMirror({ classificationPaused: false }, true);
            sendResponse({ success: true, data: status, ...status });
            break;
          }

          case 'pauseClassification':
          case 'pause-classification': {
            const status = await vfsWsClient.pauseClassification();
            applyConfigMirror({ classificationPaused: true }, true);
            sendResponse({ success: true, data: status, ...status });
            break;
          }

          case 'getClassificationControlStatus':
          case 'get-classification-control-status': {
            const status = await vfsWsClient.getSchedulerStatus();
            sendResponse({ success: true, data: status, ...status });
            break;
          }

          // Ollama (owned by the app)
          case 'listOllamaModels':
          case 'list-ollama-models': {
            const models = await vfsWsClient.listOllamaModels();
            sendResponse({
              success: true,
              data: models,
              models: models.models,
              selectedModel: models.selectedModel,
            });
            break;
          }

          case 'isOllamaAvailable': {
            const { available } = await vfsWsClient.isOllamaAvailable();
            sendResponse({ available });
            break;
          }

          case 'checkOllamaHealth': {
            const { available } = await vfsWsClient.checkOllamaHealth();
            sendResponse({ available });
            break;
          }

          // Tag vocabulary
          case 'getTagCounts': {
            const tagCounts = await vfsWsClient.getTagCounts();
            sendResponse({ success: true, data: tagCounts, ...tagCounts });
            break;
          }

          case 'listTags':
          case 'list-tags': {
            const tags = await vfsWsClient.listTags({
              limit: message.limit,
              pinnedOnly: message.pinnedOnly,
            });
            sendResponse({ success: true, data: tags, tags });
            break;
          }

          case 'getTagVocabulary': {
            const vocabulary = await vfsWsClient.getTagVocabulary(message.limit);
            sendResponse({ success: true, data: vocabulary, vocabulary });
            break;
          }

          case 'renameTag': {
            const tag = await vfsWsClient.renameTag(message.id, message.name, message.label);
            sendResponse({ success: true, data: tag, tag });
            break;
          }

          case 'mergeTags': {
            const tag = await vfsWsClient.mergeTags(message.sourceId, message.targetId);
            sendResponse({ success: true, data: tag, tag });
            break;
          }

          case 'deleteTag': {
            const result = await vfsWsClient.deleteTag(message.id);
            sendResponse({ ...result, data: result });
            break;
          }

          case 'setTagPinned': {
            const tag = await vfsWsClient.setTagPinned(message.id, message.pinned);
            sendResponse({ success: true, data: tag, tag });
            break;
          }

          // Status checks
          case 'isVFSConnected': {
            sendResponse({ connected: fileManager.isConnected() });
            break;
          }

          case 'reconnectVFS': {
            vfsWsClient.disconnect();
            vfsWsClient.connect();
            sendResponse({ success: true });
            break;
          }

          case 'get-status': {
            let ollamaAvailable = false;
            try {
              ollamaAvailable = (await vfsWsClient.isOllamaAvailable()).available;
            } catch {
              ollamaAvailable = false;
            }
            sendResponse({
              vfsConnected: fileManager.isConnected(),
              ollamaAvailable,
            });
            break;
          }

          // Capture controls
          case 'capture:get-state': {
            const tabId = typeof message.tabId === 'number' ? message.tabId : sender.tab?.id;
            if (typeof tabId !== 'number') {
              sendResponse({ success: false, error: 'Missing tabId for capture state' });
              break;
            }
            const captureState = getDebuggerCaptureController().getState(tabId);
            sendResponse({ success: true, data: captureState, ...captureState });
            break;
          }

          case 'capture:start': {
            const tabId = typeof message.tabId === 'number' ? message.tabId : sender.tab?.id;
            if (typeof tabId !== 'number') {
              sendResponse({ success: false, error: 'Missing tabId for capture start' });
              break;
            }
            const captureState = await getDebuggerCaptureController().start(tabId);
            sendResponse({
              success: captureState.status !== 'error',
              data: captureState,
              ...captureState,
              error: captureState.error,
            });
            break;
          }

          case 'capture:stop': {
            const tabId = typeof message.tabId === 'number' ? message.tabId : sender.tab?.id;
            if (typeof tabId !== 'number') {
              sendResponse({ success: false, error: 'Missing tabId for capture stop' });
              break;
            }
            const captureState = await getDebuggerCaptureController().stop(tabId);
            sendResponse({ success: true, data: captureState, ...captureState });
            break;
          }

          case 'capture:get-session': {
            const snapshot = getCaptureSessionStore().getSnapshot();
            sendResponse({ success: true, data: snapshot, snapshot });
            break;
          }

          case 'capture:clear-log': {
            getCaptureSessionStore().clearLog();
            const snapshot = getCaptureSessionStore().getSnapshot();
            sendResponse({ success: true, data: snapshot, snapshot });
            break;
          }

          case 'video-download:result': {
            getVideoDownloadManager().handleResult(message.data as VideoDownloadResult);
            sendResponse({ success: true });
            break;
          }

          case 'devToolsOpened':
          case 'setCaptureEnabled': {
            sendResponse({ success: true });
            break;
          }

          default:
            console.log('[Media Extension] Unknown message type:', message.type);
            sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Media Extension] Message handling error:', errorMessage);
        sendResponse({ success: false, error: errorMessage });
      }
    })();

    return true; // Keep message channel open for async response
  });
});

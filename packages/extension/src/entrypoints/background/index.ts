/**
 * Extension Background Service Worker
 *
 * Central coordinator for file operations and AI classification.
 */

import { initVFSWebSocketClient, getVFSWebSocketClient } from '../../background/vfs-ws-client';
import { defineBackground } from 'wxt/utils/define-background';
import { initFileManager, getFileManager } from '../../background/file-manager';
import { initOllamaClient, getOllamaClient } from '../../background/classify/ollama-client';
import { initClassifyScheduler, getClassifyScheduler } from '../../background/classify/scheduler';
import { initConfigManager, getConfigManager } from '../../background/config-manager';
import {
  initDebuggerCaptureController,
  getDebuggerCaptureController,
} from '../../background/debugger-capture';

export default defineBackground(() => {
  console.log('[VFS Extension] Background service worker starting...');

  if (chrome.sidePanel?.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => {
      console.warn('[VFS Extension] Failed to configure side panel behavior:', error);
    });
  }

  // Initialize all modules
  async function initialize(): Promise<void> {
    console.log('[VFS Extension] ========== STARTING INITIALIZATION ==========');
    try {
      // Initialize Config Manager first
      console.log('[VFS Extension] Step 1: Initializing Config Manager...');
      const configManager = await initConfigManager();
      const config = configManager.getConfig();
      console.log('[VFS Extension] Config loaded:', {
        ollamaEndpoint: config.ollamaEndpoint,
        visionModel: config.visionModel,
      });

      // Initialize VFS WebSocket Client FIRST
      console.log('[VFS Extension] Step 2: Initializing VFS WebSocket Client...');
      const vfsWsClient = initVFSWebSocketClient();
      console.log(
        '[VFS Extension] VFS WebSocket Client instance created, singleton ID:',
        vfsWsClient.constructor.name
      );

      // Initialize File Manager (will use existing VFS WebSocket Client instance)
      console.log('[VFS Extension] Step 3: Initializing File Manager...');
      initFileManager();
      console.log('[VFS Extension] File Manager initialized');

      // Check that File Manager uses the same VFS WebSocket Client instance
      const fileManagerVfsClient = getVFSWebSocketClient();
      console.log(
        '[VFS Extension] File Manager VFS Client singleton ID:',
        fileManagerVfsClient.constructor.name
      );
      console.log(
        '[VFS Extension] Are they the same instance?',
        vfsWsClient === fileManagerVfsClient
      );

      // Wait for connection with timeout
      console.log('[VFS Extension] Step 4: Waiting for VFS WebSocket connection...');
      const connectionPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.log('[VFS Extension] VFS connection timeout after 10s');
          reject(new Error('VFS WebSocket connection timeout'));
        }, 10000);

        vfsWsClient.onConnect(() => {
          console.log('[VFS Extension] ✓ VFS onConnect callback triggered!');
          clearTimeout(timeout);
          resolve();
        });

        // If already connected, resolve immediately
        if (vfsWsClient.isConnected()) {
          console.log('[VFS Extension] ✓ VFS already connected!');
          clearTimeout(timeout);
          resolve();
        }
      });

      try {
        await connectionPromise;
        console.log('[VFS Extension] ✓ VFS WebSocket connected successfully');
        // File Manager already broadcasted vfs:connected via its onConnect callback
      } catch {
        console.warn('[VFS Extension] ✗ VFS WebSocket not connected, will auto-reconnect');
        getFileManager().broadcastEvent('vfs:disconnected', { error: 'Connection timeout' });
      }

      // Set up event handling for real-time updates
      console.log('[VFS Extension] Step 5: Setting up VFS event handling...');
      vfsWsClient.onEvent((event, data) => {
        console.log(`[VFS Extension] VFS Event received: ${event}`, data);
        getFileManager().broadcastEvent(event, data);
      });

      // Initialize Ollama Client
      console.log('[VFS Extension] Step 6: Initializing Ollama Client...');
      const ollamaClient = await initOllamaClient({
        endpoint: config.ollamaEndpoint,
        model: config.visionModel,
        language: config.language,
        filenameStyle: config.filenameStyle,
        filenameStylePrompt: config.filenameStylePrompt,
        userDefinedTags: config.userDefinedTags,
      });
      console.log('[VFS Extension] Ollama Client created, endpoint:', config.ollamaEndpoint);

      // Set up Ollama status callback BEFORE checking health
      console.log('[VFS Extension] Step 7: Setting up Ollama status callback...');
      ollamaClient.onStatus((available) => {
        console.log(`[VFS Extension] ✓ Ollama onStatus callback triggered! available=${available}`);
        getFileManager().broadcastEvent('ollama:status', { available });
      });

      // Check health immediately (will trigger onStatus callback)
      console.log('[VFS Extension] Step 8: Checking Ollama health...');
      const healthResult = await ollamaClient.checkHealth();
      console.log('[VFS Extension] Ollama health check result:', healthResult);

      if (healthResult) {
        try {
          // 如果没有配置模型，选择服务端返回的第一个视觉模型
          if (!config.visionModel) {
            const { models, selectedModel, changed } = await ollamaClient.selectAvailableModel();
            if (selectedModel && changed) {
              await configManager.updateConfig({ visionModel: selectedModel });
              console.log('[VFS Extension] Auto-selected vision model:', selectedModel);
            }
            getFileManager().broadcastEvent('ollama:models', {
              models,
              selectedModel: selectedModel || config.visionModel,
              changed,
            });
          } else {
            // Non-mutating model discovery: fetch models without overwriting the configured model.
            const models = await ollamaClient.listModels();
            getFileManager().broadcastEvent('ollama:models', {
              models,
              selectedModel: config.visionModel,
              changed: false,
            });
          }
        } catch (error) {
          console.warn('[VFS Extension] Ollama model discovery failed:', error);
        }
      }

      // Start periodic health check (30 seconds)
      console.log('[VFS Extension] Step 9: Starting Ollama periodic health check (30s interval)');
      ollamaClient.startPeriodicHealthCheck(30000);

      // Initialize Classification Scheduler
      console.log('[VFS Extension] Step 10: Initializing Classification Scheduler...');
      initClassifyScheduler({
        concurrency: config.classificationConcurrency,
        autoStart: !config.classificationPaused,
      });

      console.log('[VFS Extension] Step 11: Initializing Debugger Capture Controller...');
      initDebuggerCaptureController({
        getFileManager,
        getScheduler: getClassifyScheduler,
      });

      console.log('[VFS Extension] ========== INITIALIZATION COMPLETE ==========');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[VFS Extension] ========== INITIALIZATION FAILED ==========`);
      console.error(`[VFS Extension] Error: ${message}`);
    }
  }

  // Start initialization
  initialize();

  // Handle messages from Content Scripts, DevTools Panel, Options, and Side Panel
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const fileManager = getFileManager();
    const scheduler = getClassifyScheduler();
    const configManager = getConfigManager();

    // Handle async responses
    (async () => {
      try {
        switch (message.type) {
          // File operations
          /* eslint-disable no-case-declarations */
          case 'capture:media':
            const captureResult = await fileManager.handleCaptureMedia(message.data);
            // Auto-enqueue for classification
            if (!captureResult.duplicate) {
              await scheduler.enqueue(captureResult.hash);
            }
            sendResponse({ success: true, data: captureResult });
            break;

          case 'listFiles':
          case 'list-files':
            const listQuery = message.query ?? {
              limit: message.limit,
              offset: message.offset,
              category: message.category,
              tag: message.tag,
            };
            // Also extract tag from message.query if available
            if (message.query?.tag) {
              listQuery.tag = message.query.tag;
            }
            console.log('[VFS Extension] Received listFiles/list-files message, query:', listQuery);
            const listResult = await fileManager.handleListFiles(listQuery);
            console.log('[VFS Extension] listFiles result:', listResult);
            sendResponse({ success: true, data: listResult, ...listResult });
            break;

          case 'deleteFile':
            const deleteResult = await fileManager.handleDeleteFile(message.hash, message.hard);
            sendResponse({ success: true, data: deleteResult });
            break;

          case 'getStats':
            const stats = await fileManager.getStats();
            sendResponse({ success: true, data: stats });
            break;

          case 'syncBlobsToIndex':
            const syncResult = await getVFSWebSocketClient().syncBlobsToIndex();
            sendResponse({ success: true, data: syncResult, ...syncResult });
            break;

          case 'clearIndex':
            const clearResult = await getVFSWebSocketClient().clearIndex();
            sendResponse({ ...clearResult, data: clearResult });
            break;

          case 'getThumbnailUrl':
            const thumbnailUrl = fileManager.getThumbnailUrl(message.hash, message.size);
            sendResponse({ success: true, data: { url: thumbnailUrl } });
            break;

          // Classification operations
          case 'getQueueStatus':
          case 'get-queue-status':
            const queueStatus = await scheduler.getQueueStatus();
            const schedulerStatus = scheduler.getSchedulerStatus();
            sendResponse({
              success: true,
              data: { ...queueStatus, scheduler: schedulerStatus },
              ...queueStatus,
              scheduler: schedulerStatus,
            });
            break;

          case 'enqueueClassification':
            const enqueueResult = await scheduler.enqueue(message.hash, message.priority);
            sendResponse({ success: true, data: { success: enqueueResult } });
            break;

          case 'requeueClassification':
          case 'requeue-classification':
            const requeueResult = await scheduler.enqueue(message.hash, message.priority ?? 10);
            sendResponse({ success: requeueResult, data: { success: requeueResult } });
            break;

          case 'retryFailedTasks':
          case 'retry-failed-tasks':
            const retryCount = await scheduler.retryFailed();
            sendResponse({ success: true, data: { count: retryCount }, count: retryCount });
            break;

          case 'clearQueue':
          case 'clear-queue':
            await scheduler.clearQueue();
            sendResponse({ success: true });
            break;

          case 'startClassification':
          case 'start-classification':
            scheduler.start();
            await configManager.updateConfig({ classificationPaused: false });
            sendResponse({
              success: true,
              data: scheduler.getSchedulerStatus(),
              ...scheduler.getSchedulerStatus(),
            });
            break;

          case 'pauseClassification':
          case 'pause-classification':
            scheduler.pause();
            await configManager.updateConfig({ classificationPaused: true });
            sendResponse({
              success: true,
              data: scheduler.getSchedulerStatus(),
              ...scheduler.getSchedulerStatus(),
            });
            break;

          case 'getClassificationControlStatus':
          case 'get-classification-control-status':
            sendResponse({
              success: true,
              data: scheduler.getSchedulerStatus(),
              ...scheduler.getSchedulerStatus(),
            });
            break;

          // Config operations
          case 'getConfig':
          case 'get-config':
            const config = configManager.getConfig();
            sendResponse({ success: true, data: config, ...config });
            break;

          case 'getTagCounts':
            const tagCounts = await getVFSWebSocketClient().getTagCounts();
            sendResponse({ success: true, data: tagCounts, ...tagCounts });
            break;

          case 'updateConfig':
            await configManager.updateConfig(message.updates);
            sendResponse({ success: true });
            break;

          case 'resetConfig':
            await configManager.reset();
            sendResponse({ success: true });
            break;

          // Status checks
          case 'isVFSConnected':
            console.log('[VFS Extension] Received isVFSConnected message');
            const vfsConnected = fileManager.isConnected();
            console.log('[VFS Extension] VFS connected:', vfsConnected);
            sendResponse({ connected: vfsConnected });
            break;

          case 'isOllamaAvailable':
            console.log('[VFS Extension] Received isOllamaAvailable message');
            const ollamaClient = getOllamaClient();
            const ollamaAvailable = ollamaClient.isAvailable();
            console.log('[VFS Extension] Ollama available:', ollamaAvailable);
            sendResponse({ available: ollamaAvailable });
            break;

          case 'checkOllamaHealth':
            console.log('[VFS Extension] Received checkOllamaHealth message');
            const ollama = getOllamaClient();
            const healthResult = await ollama.checkHealth();
            console.log('[VFS Extension] Ollama health check result:', healthResult);
            sendResponse({ available: healthResult });
            break;

          case 'listOllamaModels':
          case 'list-ollama-models':
            console.log('[VFS Extension] Received listOllamaModels message');
            try {
              // Non-mutating: just fetch models, don't overwrite user selection
              const models = await getOllamaClient().listModels();
              const configData = configManager.getConfig();
              sendResponse({
                success: true,
                data: { models, selectedModel: configData.visionModel, changed: false },
                models,
                selectedModel: configData.visionModel,
              });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.warn('[VFS Extension] Ollama model discovery failed:', errorMessage);
              sendResponse({ success: false, error: errorMessage });
            }
            break;

          case 'reconnectVFS':
            console.log('[VFS Extension] Received reconnectVFS message');
            const vfsWsClient = getVFSWebSocketClient();
            console.log('[VFS Extension] Disconnecting VFS...');
            vfsWsClient.disconnect();
            console.log('[VFS Extension] Connecting VFS...');
            vfsWsClient.connect();
            sendResponse({ success: true });
            break;

          case 'get-status':
            console.log('[VFS Extension] Received get-status message');
            const vfsStatus = fileManager.isConnected();
            const ollamaStatus = getOllamaClient().isAvailable();
            console.log('[VFS Extension] Current status: VFS=', vfsStatus, 'Ollama=', ollamaStatus);
            sendResponse({
              vfsConnected: vfsStatus,
              ollamaAvailable: ollamaStatus,
            });
            break;

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

          case 'devToolsOpened':
            console.log('[VFS Extension] Received devToolsOpened message');
            sendResponse({ success: true });
            break;

          case 'setCaptureEnabled':
            console.log('[VFS Extension] Received setCaptureEnabled message:', message.enabled);
            sendResponse({ success: true });
            break;

          case 'translate-tags':
            console.log('[VFS Extension] Received translate-tags message');
            try {
              const ollamaClient = getOllamaClient();
              if (!ollamaClient.isAvailable()) {
                sendResponse({ success: false, error: 'Ollama not available' });
                break;
              }

              const translated = await ollamaClient.translateTags(message.text);
              sendResponse({ success: true, translated });
            } catch (e) {
              console.error('[VFS Extension] Translation failed:', e);
              sendResponse({ success: false, error: 'Translation failed' });
            }
            break;

          default:
            console.log('[VFS Extension] Unknown message type:', message.type);
            sendResponse({ success: false, error: `Unknown message type: ${message.type}` });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[VFS Extension] Message handling error:', errorMessage);
        sendResponse({ success: false, error: errorMessage });
      }
    })();

    return true; // Keep message channel open for async response
  });
});

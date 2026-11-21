/**
 * App Entry Point
 *
 * Composition root for the long-running backend: storage, AI, scheduler,
 * configuration, and the WebSocket/HTTP transport that serves the extension.
 */

import {
  BlobStorage,
  createHTTPServer,
  createWebSocketServer,
  SQLiteDatabase,
  ThumbnailStorage,
  VFSAPI,
  type ExternalHandler,
} from 'vfs';
import { OllamaClient } from 'ai';
import { ConfigStore } from './config-store';
import { EventBus } from './event-bus';
import { createAppExternalHandler } from './handlers';
import { MediaArchiveWorker } from './media-archive';
import { MediaEligibilityGate, SKIPPED_MEDIA_ERROR } from './media-eligibility';
import { Scheduler } from './scheduler';
import type { AppConfig } from './types';
import {
  formatWorkspaceStartupError,
  getWorkspaceInfo,
  prepareWorkspaceAtStartup,
  resolveWorkspace,
  updateWorkspacePath,
} from './workspace-config';

const WEBSOCKET_PORT = process.env.VFS_WS_PORT ? parseInt(process.env.VFS_WS_PORT, 10) : 8765;
const HTTP_PORT = process.env.VFS_HTTP_PORT ? parseInt(process.env.VFS_HTTP_PORT, 10) : 8766;
const MAX_UPLOAD_SIZE = process.env.VFS_MAX_UPLOAD_SIZE
  ? parseInt(process.env.VFS_MAX_UPLOAD_SIZE, 10)
  : undefined;

function sourceDomainOf(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl) return null;
  try {
    const host = new URL(sourceUrl).hostname.toLowerCase();
    return host.startsWith('www.') ? host.slice(4) : host;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const resolution = resolveWorkspace(process.argv.slice(2));

  let workspacePath: string;
  try {
    workspacePath = prepareWorkspaceAtStartup(resolution);
  } catch (error) {
    console.error(formatWorkspaceStartupError(resolution, error));
    process.exit(1);
  }

  const activeResolution = { ...resolution, workspacePath };

  let db: SQLiteDatabase;
  try {
    db = new SQLiteDatabase(workspacePath);
  } catch (error) {
    console.error(formatWorkspaceStartupError(activeResolution, error));
    process.exit(1);
  }
  const blobStorage = new BlobStorage(workspacePath);
  const thumbnailStorage = new ThumbnailStorage(workspacePath);
  const api = new VFSAPI(db, blobStorage, thumbnailStorage, workspacePath);

  const store = new ConfigStore(workspacePath);
  store.load();
  const events = new EventBus();
  const mediaArchive = new MediaArchiveWorker({ api, store, events, workspacePath });
  mediaArchive.start();
  const ai = new OllamaClient({
    endpoint: store.get().ollamaEndpoint,
    model: store.get().visionModel,
    language: store.get().language,
    promptTemplates: store.get().promptTemplates,
    media: {
      getMediaInfo: (hash) => {
        const metadata = api.getMetadata(hash);
        if (!metadata || metadata.is_deleted === 1) return null;
        return { mimeType: metadata.mime_type };
      },
      getDecodableImageMimeTypes: () => api.getDecodableImageMimeTypes(),
      getThumbnail: (hash, size) => api.getThumbnail({ hash, size }),
      getFile: (hash) => api.getFile(hash),
      getTagVocabulary: (limit) => api.getTagVocabulary({ limit }),
    },
  });
  const scheduler = new Scheduler({ api, ai, config: store, events });

  const external: ExternalHandler = createAppExternalHandler({
    api,
    ai,
    store,
    scheduler,
    events,
    workspace: {
      getInfo: () => getWorkspaceInfo(activeResolution),
      setPath: (target) => updateWorkspacePath(target, activeResolution),
    },
    mediaArchive: {
      getStatus: () => mediaArchive.getStatus(),
      updateConfig: (update) => mediaArchive.updateConfig(update),
      runNow: () => mediaArchive.runNow(),
    },
  });
  const wsServer = createWebSocketServer(api, workspacePath, { port: WEBSOCKET_PORT }, external);
  const httpServer = createHTTPServer(api, {
    port: HTTP_PORT,
    maxUploadSize: MAX_UPLOAD_SIZE,
  });

  // All app events flow to the extension through the vfs transport.
  events.subscribe((event, data) => {
    wsServer.broadcastEvent(event, data);
  });

  // Auto-enqueue AI work and announce captured or restored files on ingest.
  api.setIngestHook((result) => {
    if (result.restored) {
      events.emit('file:restored', {
        hash: result.hash,
        restoredAt: new Date().toISOString(),
      });
    } else {
      events.emit('file:captured', {
        hash: result.hash,
        mimeType: result.mimeType,
        size: result.size,
        duplicate: false,
        sourceUrl: result.sourceUrl ?? null,
        sourceDomain: sourceDomainOf(result.sourceUrl),
        capturedAt: result.capturedAt,
      });
    }
    void scheduler.enqueuePair(result.hash);
    mediaArchive.enqueue(result.hash);
  });

  // Permanent deletion removes app-owned copies (archive target) before the
  // file row disappears. Restore re-enqueues archiving when it is enabled.
  api.setPurgeHook((hash, metadata) => mediaArchive.deleteArchived(hash, metadata.blob_ext));
  api.setRestoreHook((hash) => {
    mediaArchive.enqueue(hash);
  });

  const applyConfig = (next: AppConfig) => {
    ai.updateConfig({
      endpoint: next.ollamaEndpoint,
      model: next.visionModel,
      language: next.language,
      promptTemplates: next.promptTemplates,
    });
    scheduler.updateConcurrency(next.classificationConcurrency);
    if (next.classificationPaused) {
      scheduler.pause();
    } else {
      scheduler.start();
    }
  };

  store.onChange((next) => {
    applyConfig(next);
    mediaArchive.reconfigure();
    events.emit('config:updated', next);
  });

  ai.onStatus((available) => events.emit('ollama:status', { available }));
  ai.startPeriodicHealthCheck(30000);
  const available = await ai.checkHealth();

  if (available) {
    try {
      if (!store.get().visionModel) {
        const { models, selectedModel, changed } = await ai.selectAvailableModel();
        if (selectedModel && changed) {
          // Runtime-derived, not user-authoritative: allow legacy migration.
          store.updateRuntime({ visionModel: selectedModel });
        }
        events.emit('ollama:models', {
          models,
          selectedModel: selectedModel ?? store.get().visionModel,
          changed,
        });
      } else {
        const models = await ai.listModels();
        events.emit('ollama:models', {
          models,
          selectedModel: store.get().visionModel,
          changed: false,
        });
      }
    } catch (error) {
      console.warn('[App] Ollama model discovery failed:', error);
    }
  }

  await scheduler.recoverStale();

  // Convert persisted tasks for media the AI pipeline cannot process so old
  // poison does not stay queued or counted as failed. Runs before the
  // scheduler starts claiming work.
  try {
    const eligibilityGate = new MediaEligibilityGate(api);
    const ineligibleMimeTypes = eligibilityGate.ineligibleMimeTypes();
    if (ineligibleMimeTypes.length > 0) {
      const { count } = api.skipIneligibleTasks({
        ineligibleMimeTypes,
        error: SKIPPED_MEDIA_ERROR,
      });
      if (count > 0) {
        console.error(
          `[App] Skipped ${count} task(s) for AI-ineligible media: ${ineligibleMimeTypes.join(', ')}`
        );
      }
    }
  } catch (error) {
    console.warn('[App] Failed to reconcile ineligible AI tasks:', error);
  }

  if (!store.get().classificationPaused) {
    scheduler.start();
  }

  const shutdown = () => {
    console.error('\nShutting down app...');
    mediaArchive.stop();
    scheduler.stop();
    ai.stopPeriodicHealthCheck();
    wsServer.close();
    httpServer.close();
    db.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.error('Media app started');
  console.error(`Workspace: ${workspacePath} (source: ${resolution.source})`);
  console.error(`WebSocket: ws://localhost:${WEBSOCKET_PORT}`);
  console.error(`HTTP: http://localhost:${HTTP_PORT}`);

  await new Promise(() => {});
}

main().catch((error) => {
  console.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

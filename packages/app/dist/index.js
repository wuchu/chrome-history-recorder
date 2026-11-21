"use strict";
/**
 * App Entry Point
 *
 * Composition root for the long-running backend: storage, AI, scheduler,
 * configuration, and the WebSocket/HTTP transport that serves the extension.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const vfs_1 = require("vfs");
const ai_1 = require("ai");
const config_store_1 = require("./config-store");
const event_bus_1 = require("./event-bus");
const handlers_1 = require("./handlers");
const media_archive_1 = require("./media-archive");
const media_eligibility_1 = require("./media-eligibility");
const scheduler_1 = require("./scheduler");
const workspace_config_1 = require("./workspace-config");
const WEBSOCKET_PORT = process.env.VFS_WS_PORT ? parseInt(process.env.VFS_WS_PORT, 10) : 8765;
const HTTP_PORT = process.env.VFS_HTTP_PORT ? parseInt(process.env.VFS_HTTP_PORT, 10) : 8766;
const MAX_UPLOAD_SIZE = process.env.VFS_MAX_UPLOAD_SIZE
    ? parseInt(process.env.VFS_MAX_UPLOAD_SIZE, 10)
    : undefined;
function sourceDomainOf(sourceUrl) {
    if (!sourceUrl)
        return null;
    try {
        const host = new URL(sourceUrl).hostname.toLowerCase();
        return host.startsWith('www.') ? host.slice(4) : host;
    }
    catch {
        return null;
    }
}
async function main() {
    const resolution = (0, workspace_config_1.resolveWorkspace)(process.argv.slice(2));
    let workspacePath;
    try {
        workspacePath = (0, workspace_config_1.prepareWorkspaceAtStartup)(resolution);
    }
    catch (error) {
        console.error((0, workspace_config_1.formatWorkspaceStartupError)(resolution, error));
        process.exit(1);
    }
    const activeResolution = { ...resolution, workspacePath };
    let db;
    try {
        db = new vfs_1.SQLiteDatabase(workspacePath);
    }
    catch (error) {
        console.error((0, workspace_config_1.formatWorkspaceStartupError)(activeResolution, error));
        process.exit(1);
    }
    const blobStorage = new vfs_1.BlobStorage(workspacePath);
    const thumbnailStorage = new vfs_1.ThumbnailStorage(workspacePath);
    const api = new vfs_1.VFSAPI(db, blobStorage, thumbnailStorage, workspacePath);
    const store = new config_store_1.ConfigStore(workspacePath);
    store.load();
    const events = new event_bus_1.EventBus();
    const mediaArchive = new media_archive_1.MediaArchiveWorker({ api, store, events, workspacePath });
    mediaArchive.start();
    const ai = new ai_1.OllamaClient({
        endpoint: store.get().ollamaEndpoint,
        model: store.get().visionModel,
        language: store.get().language,
        promptTemplates: store.get().promptTemplates,
        media: {
            getMediaInfo: (hash) => {
                const metadata = api.getMetadata(hash);
                if (!metadata || metadata.is_deleted === 1)
                    return null;
                return { mimeType: metadata.mime_type };
            },
            getDecodableImageMimeTypes: () => api.getDecodableImageMimeTypes(),
            getThumbnail: (hash, size) => api.getThumbnail({ hash, size }),
            getFile: (hash) => api.getFile(hash),
            getTagVocabulary: (limit) => api.getTagVocabulary({ limit }),
        },
    });
    const scheduler = new scheduler_1.Scheduler({ api, ai, config: store, events });
    const external = (0, handlers_1.createAppExternalHandler)({
        api,
        ai,
        store,
        scheduler,
        events,
        workspace: {
            getInfo: () => (0, workspace_config_1.getWorkspaceInfo)(activeResolution),
            setPath: (target) => (0, workspace_config_1.updateWorkspacePath)(target, activeResolution),
        },
        mediaArchive: {
            getStatus: () => mediaArchive.getStatus(),
            updateConfig: (update) => mediaArchive.updateConfig(update),
            runNow: () => mediaArchive.runNow(),
        },
    });
    const wsServer = (0, vfs_1.createWebSocketServer)(api, workspacePath, { port: WEBSOCKET_PORT }, external);
    const httpServer = (0, vfs_1.createHTTPServer)(api, {
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
        }
        else {
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
    const applyConfig = (next) => {
        ai.updateConfig({
            endpoint: next.ollamaEndpoint,
            model: next.visionModel,
            language: next.language,
            promptTemplates: next.promptTemplates,
        });
        scheduler.updateConcurrency(next.classificationConcurrency);
        if (next.classificationPaused) {
            scheduler.pause();
        }
        else {
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
            }
            else {
                const models = await ai.listModels();
                events.emit('ollama:models', {
                    models,
                    selectedModel: store.get().visionModel,
                    changed: false,
                });
            }
        }
        catch (error) {
            console.warn('[App] Ollama model discovery failed:', error);
        }
    }
    await scheduler.recoverStale();
    // Convert persisted tasks for media the AI pipeline cannot process so old
    // poison does not stay queued or counted as failed. Runs before the
    // scheduler starts claiming work.
    try {
        const eligibilityGate = new media_eligibility_1.MediaEligibilityGate(api);
        const ineligibleMimeTypes = eligibilityGate.ineligibleMimeTypes();
        if (ineligibleMimeTypes.length > 0) {
            const { count } = api.skipIneligibleTasks({
                ineligibleMimeTypes,
                error: media_eligibility_1.SKIPPED_MEDIA_ERROR,
            });
            if (count > 0) {
                console.error(`[App] Skipped ${count} task(s) for AI-ineligible media: ${ineligibleMimeTypes.join(', ')}`);
            }
        }
    }
    catch (error) {
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
    await new Promise(() => { });
}
main().catch((error) => {
    console.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map
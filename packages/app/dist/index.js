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
const scheduler_1 = require("./scheduler");
const WEBSOCKET_PORT = process.env.VFS_WS_PORT ? parseInt(process.env.VFS_WS_PORT, 10) : 8765;
const HTTP_PORT = process.env.VFS_HTTP_PORT ? parseInt(process.env.VFS_HTTP_PORT, 10) : 8766;
const MAX_UPLOAD_SIZE = process.env.VFS_MAX_UPLOAD_SIZE
    ? parseInt(process.env.VFS_MAX_UPLOAD_SIZE, 10)
    : undefined;
async function main() {
    const config = (0, vfs_1.parseArgs)(process.argv.slice(2));
    (0, vfs_1.ensureWorkspace)(config.workspacePath);
    const db = new vfs_1.SQLiteDatabase(config.workspacePath);
    const blobStorage = new vfs_1.BlobStorage(config.workspacePath);
    const thumbnailStorage = new vfs_1.ThumbnailStorage(config.workspacePath);
    const api = new vfs_1.VFSAPI(db, blobStorage, thumbnailStorage, config.workspacePath);
    const store = new config_store_1.ConfigStore(config.workspacePath);
    store.load();
    const events = new event_bus_1.EventBus();
    const ai = new ai_1.OllamaClient({
        endpoint: store.get().ollamaEndpoint,
        model: store.get().visionModel,
        language: store.get().language,
        promptTemplates: store.get().promptTemplates,
        media: {
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
    });
    const wsServer = (0, vfs_1.createWebSocketServer)(api, config.workspacePath, { port: WEBSOCKET_PORT }, external);
    const httpServer = (0, vfs_1.createHTTPServer)(api, {
        port: HTTP_PORT,
        maxUploadSize: MAX_UPLOAD_SIZE,
    });
    // All app events flow to the extension through the vfs transport.
    events.subscribe((event, data) => {
        wsServer.broadcastEvent(event, data);
    });
    // Auto-enqueue AI work and announce captured files on ingest.
    api.setIngestHook((result) => {
        events.emit('file:captured', {
            hash: result.hash,
            mimeType: result.mimeType,
            size: result.size,
            duplicate: false,
        });
        void scheduler.enqueuePair(result.hash);
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
    if (!store.get().classificationPaused) {
        scheduler.start();
    }
    const shutdown = () => {
        console.error('\nShutting down app...');
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
    console.error(`Workspace: ${config.workspacePath}`);
    console.error(`WebSocket: ws://localhost:${WEBSOCKET_PORT}`);
    console.error(`HTTP: http://localhost:${HTTP_PORT}`);
    await new Promise(() => { });
}
main().catch((error) => {
    console.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
//# sourceMappingURL=index.js.map
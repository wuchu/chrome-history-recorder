"use strict";
/**
 * App-owned RPC handlers.
 *
 * These are merged into the vfs dispatcher ahead of the storage method table,
 * giving the extension app-level configuration, scheduler, and Ollama calls
 * over the same WebSocket connection.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAppExternalHandler = createAppExternalHandler;
function createAppExternalHandler(dependencies) {
    const { api, ai, store, scheduler } = dependencies;
    return async (method, params) => {
        switch (method) {
            case 'getConfig':
                return store.get();
            case 'updateConfig': {
                const config = store.update((params.updates ?? {}));
                return { success: true, config };
            }
            case 'migrateConfig': {
                const imported = store.importLegacy((params.config ?? {}));
                return { imported, config: store.get() };
            }
            case 'getSchedulerStatus':
            case 'getClassificationControlStatus':
                return scheduler.getSchedulerStatus();
            case 'startClassification':
                scheduler.start();
                store.update({ classificationPaused: false });
                return scheduler.getSchedulerStatus();
            case 'pauseClassification':
                scheduler.pause();
                store.update({ classificationPaused: true });
                return scheduler.getSchedulerStatus();
            case 'listOllamaModels': {
                const models = await ai.listModels();
                return {
                    models,
                    selectedModel: store.get().visionModel,
                    changed: false,
                };
            }
            case 'checkOllamaHealth': {
                const available = await ai.checkHealth();
                return { available };
            }
            case 'isOllamaAvailable':
                return { available: ai.isAvailable() };
            case 'translateTags': {
                const translated = await ai.translateTags(String(params.text ?? ''));
                return { translated };
            }
            /**
             * Scheduler-aware task mutations. The storage dispatcher would handle
             * these too, but the app wants to kick the scheduler immediately.
             */
            case 'enqueueTask': {
                const result = api.enqueueTask(params);
                scheduler.kick();
                return result;
            }
            case 'enqueueClassification': {
                const result = api.enqueueClassification(params);
                scheduler.kick();
                return result;
            }
            case 'requeueTask': {
                const result = api.requeueTask(params);
                scheduler.kick();
                return result;
            }
            case 'requeueAll': {
                const result = api.requeueAll(params);
                scheduler.kick();
                return result;
            }
            case 'retryFailedTasks': {
                const result = api.retryFailedTasks(params);
                scheduler.kick();
                return result;
            }
            case 'clearQueue':
                return api.clearQueue(params);
            case 'recoverStaleProcessingTasks': {
                const result = api.recoverStaleProcessingTasks();
                scheduler.kick();
                return result;
            }
            case 'updateTaskStatus':
                return api.updateTaskStatus(params);
            default:
                return undefined;
        }
    };
}
//# sourceMappingURL=handlers.js.map
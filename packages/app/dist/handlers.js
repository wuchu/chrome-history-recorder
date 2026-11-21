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
    const { api, ai, store, scheduler, workspace, mediaArchive } = dependencies;
    return async (method, params) => {
        switch (method) {
            case 'getConfig':
                return store.get();
            case 'getWorkspaceConfig':
                return workspace.getInfo();
            case 'setWorkspacePath': {
                const target = typeof params.path === 'string' ? params.path.trim() : '';
                const { pendingPath } = workspace.setPath(target);
                return { success: true, restartRequired: true, pendingPath };
            }
            case 'getMediaArchiveStatus':
                return mediaArchive.getStatus();
            case 'updateMediaArchiveConfig':
                return mediaArchive.updateConfig({
                    enabled: typeof params.enabled === 'boolean' ? params.enabled : undefined,
                    targetPath: typeof params.targetPath === 'string' ? params.targetPath : undefined,
                    intervalMinutes: typeof params.intervalMinutes === 'number' ? params.intervalMinutes : undefined,
                });
            case 'runMediaArchiveNow':
                return mediaArchive.runNow();
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
            /**
             * Scheduler-aware task mutations. The scheduler owns eligibility, so
             * ineligible media is recorded as skipped instead of pending.
             */
            case 'enqueueTask': {
                const { taskType, hash, priority, maxAttempts, requeue } = params;
                if (!taskType || !hash)
                    return { success: false };
                const success = await scheduler.enqueueTask(taskType, hash, {
                    priority: typeof priority === 'number' ? priority : undefined,
                    maxAttempts: typeof maxAttempts === 'number' ? maxAttempts : undefined,
                    requeue: requeue === true,
                });
                return { success };
            }
            case 'enqueueClassification': {
                const { hash, priority } = params;
                if (!hash)
                    return { success: false };
                const success = await scheduler.enqueueTask('classify', hash, {
                    priority: typeof priority === 'number' ? priority : undefined,
                    requeue: true,
                });
                return { success };
            }
            case 'requeueTask': {
                const { taskType, hash } = params;
                if (!taskType || !hash)
                    return { success: false };
                return scheduler.requeueTask(taskType, hash);
            }
            case 'requeueAll': {
                const { taskType } = params;
                const count = await scheduler.requeueAll(taskType);
                return { count };
            }
            case 'retryFailedTasks': {
                const { taskType } = params;
                const count = await scheduler.retryFailed(taskType);
                return { count };
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
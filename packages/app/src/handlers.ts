/**
 * App-owned RPC handlers.
 *
 * These are merged into the vfs dispatcher ahead of the storage method table,
 * giving the extension app-level configuration, scheduler, and Ollama calls
 * over the same WebSocket connection.
 */

import type { ExternalHandler, VFSAPI } from 'vfs';
import type { OllamaClient } from 'ai';
import type { ConfigStore } from './config-store';
import type { EventBus } from './event-bus';
import type { Scheduler } from './scheduler';
import type { AppConfig } from './types';

export interface AppHandlerDependencies {
  api: VFSAPI;
  ai: OllamaClient;
  store: ConfigStore;
  scheduler: Scheduler;
  events: EventBus;
}

export function createAppExternalHandler(dependencies: AppHandlerDependencies): ExternalHandler {
  const { api, ai, store, scheduler } = dependencies;

  return async (method: string, params: Record<string, unknown>) => {
    switch (method) {
      case 'getConfig':
        return store.get();

      case 'updateConfig': {
        const config = store.update((params.updates ?? {}) as Partial<AppConfig>);
        return { success: true, config };
      }

      case 'migrateConfig': {
        const imported = store.importLegacy((params.config ?? {}) as Partial<AppConfig>);
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
        const result = api.enqueueTask(params as unknown as Parameters<typeof api.enqueueTask>[0]);
        scheduler.kick();
        return result;
      }

      case 'enqueueClassification': {
        const result = api.enqueueClassification(
          params as unknown as Parameters<typeof api.enqueueClassification>[0]
        );
        scheduler.kick();
        return result;
      }

      case 'requeueTask': {
        const result = api.requeueTask(params as unknown as Parameters<typeof api.requeueTask>[0]);
        scheduler.kick();
        return result;
      }

      case 'requeueAll': {
        const result = api.requeueAll(params as unknown as Parameters<typeof api.requeueAll>[0]);
        scheduler.kick();
        return result;
      }

      case 'retryFailedTasks': {
        const result = api.retryFailedTasks(
          params as unknown as Parameters<typeof api.retryFailedTasks>[0]
        );
        scheduler.kick();
        return result;
      }

      case 'clearQueue':
        return api.clearQueue(params as unknown as Parameters<typeof api.clearQueue>[0]);

      case 'recoverStaleProcessingTasks': {
        const result = api.recoverStaleProcessingTasks();
        scheduler.kick();
        return result;
      }

      case 'updateTaskStatus':
        return api.updateTaskStatus(
          params as unknown as Parameters<typeof api.updateTaskStatus>[0]
        );

      default:
        return undefined;
    }
  };
}

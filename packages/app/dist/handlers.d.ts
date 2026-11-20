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
export interface AppHandlerDependencies {
    api: VFSAPI;
    ai: OllamaClient;
    store: ConfigStore;
    scheduler: Scheduler;
    events: EventBus;
}
export declare function createAppExternalHandler(dependencies: AppHandlerDependencies): ExternalHandler;
//# sourceMappingURL=handlers.d.ts.map
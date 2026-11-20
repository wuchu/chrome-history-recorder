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
import type { WorkspaceInfo, WorkspaceUpdateResult } from './workspace-config';
import type { MediaArchiveConfigUpdate, MediaArchiveStatus } from './media-archive';
export interface AppWorkspaceHandlers {
    getInfo(): WorkspaceInfo;
    setPath(target: string): WorkspaceUpdateResult;
}
export interface AppMediaArchiveHandlers {
    getStatus(): MediaArchiveStatus;
    updateConfig(update: MediaArchiveConfigUpdate): MediaArchiveStatus;
    runNow(): MediaArchiveStatus;
}
export interface AppHandlerDependencies {
    api: VFSAPI;
    ai: OllamaClient;
    store: ConfigStore;
    scheduler: Scheduler;
    events: EventBus;
    workspace: AppWorkspaceHandlers;
    mediaArchive: AppMediaArchiveHandlers;
}
export declare function createAppExternalHandler(dependencies: AppHandlerDependencies): ExternalHandler;
//# sourceMappingURL=handlers.d.ts.map
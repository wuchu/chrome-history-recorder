/**
 * App Event Bus
 *
 * The app-owned aggregation point for storage, scheduler, AI, and config
 * events. The app forwards these to the vfs transport, which relays them to
 * the extension.
 */
export type AppEvent = string;
export type AppEventListener = (event: AppEvent, data: unknown) => void;
export declare class EventBus {
    private listeners;
    subscribe(listener: AppEventListener): () => void;
    emit(event: AppEvent, data: unknown): void;
}
//# sourceMappingURL=event-bus.d.ts.map
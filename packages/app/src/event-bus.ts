/**
 * App Event Bus
 *
 * The app-owned aggregation point for storage, scheduler, AI, and config
 * events. The app forwards these to the vfs transport, which relays them to
 * the extension.
 */

export type AppEvent = string;
export type AppEventListener = (event: AppEvent, data: unknown) => void;

export class EventBus {
  private listeners = new Set<AppEventListener>();

  subscribe(listener: AppEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: AppEvent, data: unknown): void {
    for (const listener of this.listeners) {
      try {
        listener(event, data);
      } catch (error) {
        console.warn(`[EventBus] Listener failed for event ${event}:`, error);
      }
    }
  }
}

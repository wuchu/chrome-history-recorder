"use strict";
/**
 * App Event Bus
 *
 * The app-owned aggregation point for storage, scheduler, AI, and config
 * events. The app forwards these to the vfs transport, which relays them to
 * the extension.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventBus = void 0;
class EventBus {
    listeners = new Set();
    subscribe(listener) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    emit(event, data) {
        for (const listener of this.listeners) {
            try {
                listener(event, data);
            }
            catch (error) {
                console.warn(`[EventBus] Listener failed for event ${event}:`, error);
            }
        }
    }
}
exports.EventBus = EventBus;
//# sourceMappingURL=event-bus.js.map
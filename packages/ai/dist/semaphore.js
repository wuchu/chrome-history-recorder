"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncSemaphore = void 0;
/**
 * Minimal FIFO async semaphore used to bound concurrent Ollama chat requests.
 *
 * The capacity may change at runtime. Lowering it never cancels work already
 * holding a slot; queued callers are admitted only when the active count drops
 * below the new capacity.
 */
class AsyncSemaphore {
    capacity;
    activeCountValue = 0;
    waiters = [];
    constructor(capacity) {
        this.capacity = normalizeCapacity(capacity);
    }
    get activeCount() {
        return this.activeCountValue;
    }
    get waitingCount() {
        return this.waiters.length;
    }
    get maxConcurrency() {
        return this.capacity;
    }
    /**
     * Wait for a slot. The returned function releases the slot exactly once.
     */
    acquire() {
        return new Promise((resolve) => {
            const grant = () => {
                this.activeCountValue += 1;
                let released = false;
                resolve(() => {
                    if (released)
                        return;
                    released = true;
                    this.release();
                });
            };
            if (this.activeCountValue < this.capacity) {
                grant();
            }
            else {
                this.waiters.push(grant);
            }
        });
    }
    setCapacity(capacity) {
        this.capacity = normalizeCapacity(capacity);
        this.drainWaiters();
    }
    release() {
        this.activeCountValue = Math.max(0, this.activeCountValue - 1);
        this.drainWaiters();
    }
    drainWaiters() {
        while (this.waiters.length > 0 && this.activeCountValue < this.capacity) {
            const next = this.waiters.shift();
            next?.();
        }
    }
}
exports.AsyncSemaphore = AsyncSemaphore;
function normalizeCapacity(value) {
    return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}
//# sourceMappingURL=semaphore.js.map
/**
 * Minimal FIFO async semaphore used to bound concurrent Ollama chat requests.
 *
 * The capacity may change at runtime. Lowering it never cancels work already
 * holding a slot; queued callers are admitted only when the active count drops
 * below the new capacity.
 */
export declare class AsyncSemaphore {
    private capacity;
    private activeCountValue;
    private readonly waiters;
    constructor(capacity: number);
    get activeCount(): number;
    get waitingCount(): number;
    get maxConcurrency(): number;
    /**
     * Wait for a slot. The returned function releases the slot exactly once.
     */
    acquire(): Promise<() => void>;
    setCapacity(capacity: number): void;
    private release;
    private drainWaiters;
}
//# sourceMappingURL=semaphore.d.ts.map
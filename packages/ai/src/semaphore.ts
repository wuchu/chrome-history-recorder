/**
 * Minimal FIFO async semaphore used to bound concurrent Ollama chat requests.
 *
 * The capacity may change at runtime. Lowering it never cancels work already
 * holding a slot; queued callers are admitted only when the active count drops
 * below the new capacity.
 */
export class AsyncSemaphore {
  private capacity: number;
  private activeCountValue = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(capacity: number) {
    this.capacity = normalizeCapacity(capacity);
  }

  get activeCount(): number {
    return this.activeCountValue;
  }

  get waitingCount(): number {
    return this.waiters.length;
  }

  get maxConcurrency(): number {
    return this.capacity;
  }

  /**
   * Wait for a slot. The returned function releases the slot exactly once.
   */
  acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const grant = () => {
        this.activeCountValue += 1;
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          this.release();
        });
      };

      if (this.activeCountValue < this.capacity) {
        grant();
      } else {
        this.waiters.push(grant);
      }
    });
  }

  setCapacity(capacity: number): void {
    this.capacity = normalizeCapacity(capacity);
    this.drainWaiters();
  }

  private release(): void {
    this.activeCountValue = Math.max(0, this.activeCountValue - 1);
    this.drainWaiters();
  }

  private drainWaiters(): void {
    while (this.waiters.length > 0 && this.activeCountValue < this.capacity) {
      const next = this.waiters.shift();
      next?.();
    }
  }
}

function normalizeCapacity(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
}

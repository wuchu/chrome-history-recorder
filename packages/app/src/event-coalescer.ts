/**
 * Leading + trailing event coalescer.
 *
 * The first schedule after an idle window flushes immediately; subsequent
 * schedules within the window are collapsed into one trailing flush. Producers
 * compute their snapshot only when the flush callback runs, so a burst of task
 * transitions never pays for repeated full queue or tag queries.
 */
export class EventCoalescer {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private lastFlushAt = 0;

  constructor(
    private readonly flush: () => void,
    private readonly windowMs: number = 250,
    private readonly now: () => number = Date.now
  ) {}

  schedule(): void {
    this.dirty = true;
    if (this.timer) return;

    const elapsed = this.now() - this.lastFlushAt;
    if (elapsed >= this.windowMs) {
      this.flushNow();
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.dirty) this.flushNow();
    }, this.windowMs - elapsed);
    this.timer.unref?.();
  }

  flushNow(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.dirty) return;
    this.dirty = false;
    this.lastFlushAt = this.now();
    this.flush();
  }

  cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.dirty = false;
  }
}

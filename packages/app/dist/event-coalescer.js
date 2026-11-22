"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventCoalescer = void 0;
/**
 * Leading + trailing event coalescer.
 *
 * The first schedule after an idle window flushes immediately; subsequent
 * schedules within the window are collapsed into one trailing flush. Producers
 * compute their snapshot only when the flush callback runs, so a burst of task
 * transitions never pays for repeated full queue or tag queries.
 */
class EventCoalescer {
    flush;
    windowMs;
    now;
    timer = null;
    dirty = false;
    lastFlushAt = 0;
    constructor(flush, windowMs = 250, now = Date.now) {
        this.flush = flush;
        this.windowMs = windowMs;
        this.now = now;
    }
    schedule() {
        this.dirty = true;
        if (this.timer)
            return;
        const elapsed = this.now() - this.lastFlushAt;
        if (elapsed >= this.windowMs) {
            this.flushNow();
            return;
        }
        this.timer = setTimeout(() => {
            this.timer = null;
            if (this.dirty)
                this.flushNow();
        }, this.windowMs - elapsed);
        this.timer.unref?.();
    }
    flushNow() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (!this.dirty)
            return;
        this.dirty = false;
        this.lastFlushAt = this.now();
        this.flush();
    }
    cancel() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        this.dirty = false;
    }
}
exports.EventCoalescer = EventCoalescer;
//# sourceMappingURL=event-coalescer.js.map
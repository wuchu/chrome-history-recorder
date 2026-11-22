/**
 * Leading + trailing event coalescer.
 *
 * The first schedule after an idle window flushes immediately; subsequent
 * schedules within the window are collapsed into one trailing flush. Producers
 * compute their snapshot only when the flush callback runs, so a burst of task
 * transitions never pays for repeated full queue or tag queries.
 */
export declare class EventCoalescer {
    private readonly flush;
    private readonly windowMs;
    private readonly now;
    private timer;
    private dirty;
    private lastFlushAt;
    constructor(flush: () => void, windowMs?: number, now?: () => number);
    schedule(): void;
    flushNow(): void;
    cancel(): void;
}
//# sourceMappingURL=event-coalescer.d.ts.map
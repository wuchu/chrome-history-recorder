import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventCoalescer } from '../src/event-coalescer';

describe('EventCoalescer', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('flushes the first call immediately and coalesces the rest', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const flush = vi.fn();
    const coalescer = new EventCoalescer(flush, 250);

    coalescer.schedule();
    expect(flush).toHaveBeenCalledTimes(1);

    coalescer.schedule();
    coalescer.schedule();
    expect(flush).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(250);
    expect(flush).toHaveBeenCalledTimes(2);
  });

  it('does not flush after cancel', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const flush = vi.fn();
    const coalescer = new EventCoalescer(flush, 250);

    coalescer.schedule();
    coalescer.schedule();
    expect(flush).toHaveBeenCalledTimes(1);

    coalescer.cancel();
    vi.advanceTimersByTime(1000);
    expect(flush).toHaveBeenCalledTimes(1);
  });
});

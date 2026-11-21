import { describe, expect, it } from 'vitest';
import { AsyncSemaphore } from '../src/semaphore';

describe('AsyncSemaphore', () => {
  it('admits waiters in FIFO order', async () => {
    const semaphore = new AsyncSemaphore(1);
    const order: string[] = [];

    const acquire = async (name: string): Promise<() => void> => {
      const release = await semaphore.acquire();
      order.push(name);
      return release;
    };

    const first = await acquire('first');
    const second = acquire('second');

    expect(order).toEqual(['first']);
    expect(semaphore.waitingCount).toBe(1);

    first();
    const releaseSecond = await second;

    expect(order).toEqual(['first', 'second']);
    expect(semaphore.activeCount).toBe(1);

    releaseSecond();
    expect(semaphore.activeCount).toBe(0);
  });

  it('applies increased capacity to queued callers', async () => {
    const semaphore = new AsyncSemaphore(1);

    const first = await semaphore.acquire();
    const second = semaphore.acquire();
    const third = semaphore.acquire();

    semaphore.setCapacity(2);
    const releaseSecond = await second;
    expect(semaphore.activeCount).toBe(2);
    expect(semaphore.waitingCount).toBe(1);

    first();
    const releaseThird = await third;
    expect(semaphore.activeCount).toBe(2);

    releaseSecond();
    releaseThird();
    expect(semaphore.activeCount).toBe(0);
  });

  it('does not cancel active holders when capacity is lowered', async () => {
    const semaphore = new AsyncSemaphore(2);
    const first = await semaphore.acquire();
    const second = await semaphore.acquire();

    semaphore.setCapacity(1);
    const third = semaphore.acquire();

    expect(semaphore.activeCount).toBe(2);
    expect(semaphore.waitingCount).toBe(1);

    first();
    expect(semaphore.waitingCount).toBe(1);
    second();
    const releaseThird = await third;
    expect(semaphore.activeCount).toBe(1);

    releaseThird();
  });
});

// A counting semaphore that hands slots directly to waiters.
//
// The naive implementation (release decrements, then wakes a waiter that
// re-increments) has a race: a new `acquire` called synchronously between the
// decrement and the waiter's continuation sees a free slot, takes it, and then
// the waiter increments too — over-admitting past the limit. Transferring the
// slot (the releaser increments on the waiter's behalf) makes the limit exact.
export interface Semaphore {
  acquire(): Promise<void>;
  release(): void;
  readonly active: number;
}

export function createSemaphore(limit: number): Semaphore {
  const max = Math.max(1, Math.floor(limit) || 1);
  let active = 0;
  const waiters: Array<() => void> = [];

  return {
    get active() {
      return active;
    },
    async acquire(): Promise<void> {
      if (active < max) {
        active += 1;
        return;
      }
      await new Promise<void>((resolve) => waiters.push(resolve));
    },
    release(): void {
      const next = waiters.shift();
      if (next) {
        // Transfer the slot: it stays counted as active for the waiter.
        next();
        return;
      }
      active = Math.max(0, active - 1);
    },
  };
}

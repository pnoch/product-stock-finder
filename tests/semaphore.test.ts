import { describe, expect, it } from "vitest";
import { createSemaphore } from "../lib/concurrency";

// lib/concurrency.ts's semaphore had no test of its own (tests/concurrency.test.ts
// covers server/concurrency.ts's mapWithConcurrency instead), so the
// over-admission race and the queue bound were both unverified.
describe("createSemaphore", () => {
  it("never over-admits when an acquire races a release", async () => {
    // The naive release (decrement, then wake a waiter that re-increments) lets
    // a new acquire slip into the gap and over-admit. Force that interleaving:
    // hold the only slot, queue a waiter, then release and synchronously acquire
    // again before the waiter's continuation can run.
    const sem = createSemaphore(1);
    await sem.acquire();
    let waiterAdmitted = false;
    const waiter = sem.acquire().then(() => {
      waiterAdmitted = true;
    });
    sem.release();
    let racerAdmitted = false;
    const racer = sem.acquire().then(() => {
      racerAdmitted = true;
    });
    // Let every queued microtask run.
    await new Promise((r) => setTimeout(r, 0));
    // Exactly one of the two may hold the single slot; the other must queue.
    expect([waiterAdmitted, racerAdmitted].filter(Boolean)).toHaveLength(1);
    // Drain: one release for the holder, one for the queued waiter.
    sem.release();
    sem.release();
    await Promise.all([waiter, racer]);
    expect(sem.active).toBe(0);
  });

  it("hands a released slot straight to a waiter without a gap", async () => {
    const sem = createSemaphore(1);
    await sem.acquire();
    let admitted = false;
    const waiter = sem.acquire().then(() => {
      admitted = true;
    });
    // A second acquire while the slot is held must queue, not run.
    let second = false;
    const secondWaiter = sem.acquire().then(() => {
      second = true;
    });
    await Promise.resolve();
    expect(admitted).toBe(false);
    sem.release();
    await waiter;
    expect(admitted).toBe(true);
    expect(second).toBe(false);
    sem.release();
    await secondWaiter;
    expect(second).toBe(true);
  });

  it("rejects once the queue is full", async () => {
    const sem = createSemaphore(1, { maxQueue: 2 });
    await sem.acquire();
    const queued = [sem.acquire(), sem.acquire()];
    // The third waiter exceeds maxQueue and must shed load.
    await expect(sem.acquire()).rejects.toThrow(/queue full/);
    sem.release();
    sem.release();
    await Promise.all(queued);
  });

  it("treats a non-positive or fractional limit as at least 1", async () => {
    const sem = createSemaphore(0);
    await sem.acquire();
    expect(sem.active).toBe(1);
    sem.release();
    expect(sem.active).toBe(0);
  });
});

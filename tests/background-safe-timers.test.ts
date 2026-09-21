import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  backgroundSafeDelay,
  backgroundSafeRace,
  setBackgroundAppState,
  type BackgroundAppState,
} from "../lib/background-safe-timers";

// Simulates Android bridgeless timer behavior while backgrounded: timers
// scheduled with any duration (including 0ms) never fire — TimerManager
// registers them with JavaTimerManager, which fires only from the
// choreographer frame callback, gated on isPaused. setImmediate is
// microtask-backed (runtime.queueMicrotask) and drains unbounded at each
// event-loop tick, so it DOES run while backgrounded. This harness installs
// global setTimeout/clearTimeout/setImmediate that reproduce that contract.
function installAndroidBackgroundTimerHarness() {
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  const pending = new Map<number, number>();
  let seq = 0;
  const stubbed = {
    setTimeout(fn: (...args: unknown[]) => void, ms?: number) {
      // >0ms AND 0ms timers are registered but never fire while paused
      const id = seq++;
      pending.set(id, ms ?? 0);
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout(id: ReturnType<typeof setTimeout>) {
      pending.delete(id as unknown as number);
    },
  };
  vi.stubGlobal("setTimeout", stubbed.setTimeout);
  vi.stubGlobal("clearTimeout", stubbed.clearTimeout);
  return {
    restore() {
      vi.unstubAllGlobals();
      void realSetTimeout;
      void realClearTimeout;
    },
    pendingCount: () => pending.size,
  };
}

describe("background-safe timers (Android backgrounded)", () => {
  let harness: ReturnType<typeof installAndroidBackgroundTimerHarness>;

  beforeEach(() => {
    harness = installAndroidBackgroundTimerHarness();
    setBackgroundAppState("background");
  });

  afterEach(() => {
    setBackgroundAppState("foreground");
    harness.restore();
  });

  it("delay resolves while backgrounded using only setImmediate ticks", async () => {
    const p = backgroundSafeDelay(50);
    // Simulate wall-clock progress: shift Date.now forward.
    const base = Date.now();
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => base + 60);
    await expect(p).resolves.toBeUndefined();
    nowSpy.mockRestore();
  });

  it("delay resolves immediately when duration is 0", async () => {
    await expect(backgroundSafeDelay(0)).resolves.toBeUndefined();
  });

  it("race resolves the winner while backgrounded", async () => {
    const winner = backgroundSafeRace(
      new Promise<string>((r) => queueMicrotask(() => r("fast"))),
      10,
    );
    await expect(winner).resolves.toBe("fast");
  });

  it("race resolves undefined on timeout while backgrounded", async () => {
    const p = backgroundSafeRace(new Promise<string>(() => {}), 10);
    const base = Date.now();
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => base + 20);
    await expect(p).resolves.toBeUndefined();
    nowSpy.mockRestore();
  });

  it("race leaves no pending timers after settle", async () => {
    const p = backgroundSafeRace(Promise.resolve("x"), 10);
    await expect(p).resolves.toBe("x");
    expect(harness.pendingCount()).toBe(0);
  });

  it("delay switches to a plain setTimeout when foregrounded mid-wait", async () => {
    vi.useFakeTimers();
    const p = backgroundSafeDelay(1000);
    // Foreground the app after the poll chain has started; the loop should
    // hand off to a plain setTimeout for the remainder.
    setBackgroundAppState("foreground");
    const base = Date.now();
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => base + 500);
    const assertion = expect(p).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(600);
    await assertion;
    nowSpy.mockRestore();
    vi.useRealTimers();
    setBackgroundAppState("background");
  });
});

describe("background-safe timers (foreground fast path)", () => {
  beforeEach(() => {
    setBackgroundAppState("foreground");
  });

  afterEach(() => {
    setBackgroundAppState("foreground");
    vi.unstubAllGlobals();
  });

  it("delay uses a plain setTimeout in the foreground", async () => {
    const spy = vi.spyOn(globalThis, "setTimeout");
    await backgroundSafeDelay(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("state transitions", () => {
  afterEach(() => {
    setBackgroundAppState("foreground");
    vi.unstubAllGlobals();
  });

  it("unknown state falls back to foreground behavior", async () => {
    setBackgroundAppState("unknown" as BackgroundAppState);
    const spy = vi.spyOn(globalThis, "setTimeout");
    await backgroundSafeDelay(1);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
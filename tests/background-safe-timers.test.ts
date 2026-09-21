import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  backgroundSafeDelay,
  backgroundSafeRace,
  setBackgroundAppState,
  type BackgroundAppState,
} from "../lib/background-safe-timers";

// Simulates Android RN timer behavior while backgrounded: timers scheduled
// with a duration > 0 never fire (JavaTimerManager gates the choreographer
// frame callback on isPaused), but 0ms timers fire immediately
// (createAndMaybeCallTimer calls callTimers directly, bypassing the frame
// callback). This harness installs a global setTimeout/clearTimeout pair
// that reproduces exactly that contract.
function installAndroidBackgroundTimerHarness() {
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  const pending = new Map<ReturnType<typeof realSetTimeout>, number>();
  let seq = 0;
  const stubbed = {
    setTimeout(fn: (...args: unknown[]) => void, ms?: number) {
      const duration = ms ?? 0;
      if (duration === 0) {
        // 0ms timers fire immediately (native callTimers path)
        const id = { __fired: true } as unknown as ReturnType<
          typeof realSetTimeout
        >;
        queueMicrotask(() => fn());
        return id;
      }
      // >0ms timers are registered but never fire while paused
      const id = seq++ as unknown as ReturnType<typeof realSetTimeout>;
      pending.set(id, duration);
      return id;
    },
    clearTimeout(id: ReturnType<typeof realSetTimeout>) {
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

  it("delay resolves while backgrounded using only 0ms timers", async () => {
    const start = Date.now();
    // Wall-clock is simulated by the 0ms chain: each tick re-checks
    // Date.now(); to make this deterministic we fake a clock advance.
    const p = backgroundSafeDelay(50);
    // Simulate wall-clock progress without timers: shift Date.now forward.
    const realNow = Date.now;
    const base = realNow();
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => base + 60);
    await expect(p).resolves.toBeUndefined();
    expect(Date.now() - start).toBeGreaterThanOrEqual(0);
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
    const realNow = Date.now;
    const base = realNow();
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => base + 20);
    await expect(p).resolves.toBeUndefined();
    nowSpy.mockRestore();
  });

  it("race leaves no pending timers after settle", async () => {
    const p = backgroundSafeRace(Promise.resolve("x"), 10);
    await expect(p).resolves.toBe("x");
    expect(harness.pendingCount()).toBe(0);
  });
});

describe("background-safe timers (foreground fast path)", () => {
  beforeEach(() => {
    setBackgroundAppState("foreground");
  });

  afterEach(() => {
    setBackgroundAppState("foreground");
    harness_restore();
  });

  function harness_restore() {
    vi.unstubAllGlobals();
  }

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
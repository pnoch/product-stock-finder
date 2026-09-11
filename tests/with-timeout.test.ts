import { describe, expect, it, vi, afterEach } from "vitest";
import { withTimeout } from "../lib/with-timeout";

describe("withTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it("resolves the value when fast", async () => {
    await expect(withTimeout(Promise.resolve(7), 4000)).resolves.toBe(7);
  });
  it("resolves null on timeout", async () => {
    vi.useFakeTimers();
    const p = withTimeout(new Promise<string>(() => {}), 4000);
    const assertion = expect(p).resolves.toBeNull();
    await vi.advanceTimersByTimeAsync(4100);
    await assertion;
    vi.useRealTimers();
  });
  it("leaves no pending timer after settle", async () => {
    vi.useFakeTimers();
    const p = withTimeout(Promise.resolve(1), 4000);
    expect(vi.getTimerCount()).toBe(1);
    await expect(p).resolves.toBe(1);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });
});

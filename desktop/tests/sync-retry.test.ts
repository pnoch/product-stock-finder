import { describe, expect, it, vi } from "vitest";
import { createForegroundSyncRetry } from "../src/lib/sync-retry";

function makeDeps(
  overrides: Partial<Parameters<typeof createForegroundSyncRetry>[0]> = {},
) {
  return {
    isSignedIn: vi.fn(() => true),
    getMeta: vi.fn(async () => ({ lastSyncError: "Pull failed" })),
    syncNow: vi.fn(),
    ...overrides,
  };
}

describe("createForegroundSyncRetry", () => {
  it("retries when the last sync failed", async () => {
    const deps = makeDeps();
    await createForegroundSyncRetry(deps)();
    expect(deps.syncNow).toHaveBeenCalledTimes(1);
  });

  it("does not retry a clean sync", async () => {
    const deps = makeDeps({
      getMeta: vi.fn(async () => ({ lastSyncError: null })),
    });
    await createForegroundSyncRetry(deps)();
    expect(deps.syncNow).not.toHaveBeenCalled();
  });

  it("does not retry while signed out", async () => {
    const deps = makeDeps({ isSignedIn: vi.fn(() => false) });
    await createForegroundSyncRetry(deps)();
    expect(deps.getMeta).not.toHaveBeenCalled();
    expect(deps.syncNow).not.toHaveBeenCalled();
  });

  it("debounces bursts within a second", async () => {
    const deps = makeDeps();
    const onForeground = createForegroundSyncRetry(deps, () => 5_000);
    await onForeground();
    await onForeground();
    expect(deps.syncNow).toHaveBeenCalledTimes(1);
  });

  it("allows a retry after the debounce window", async () => {
    const deps = makeDeps();
    let clock = 5_000;
    const onForeground = createForegroundSyncRetry(deps, () => clock);
    await onForeground();
    clock += 2_000;
    await onForeground();
    expect(deps.syncNow).toHaveBeenCalledTimes(2);
  });

  it("swallows a metadata read failure", async () => {
    const deps = makeDeps({
      getMeta: vi.fn(async () => {
        throw new Error("storage");
      }),
    });
    await expect(createForegroundSyncRetry(deps)()).resolves.toBeUndefined();
    expect(deps.syncNow).not.toHaveBeenCalled();
  });
});

import { describe, expect, it } from "vitest";
import { clearDistributorBreaker } from "../lib/scrapers/breaker-clear";
import { createStorageBreakerStore } from "../lib/scrapers/resilient";
import { DISTRIBUTOR_BREAKER_KEY } from "../lib/storage/adapter";
import type { StorageAdapter } from "../lib/storage/adapter";

function makeAdapter() {
  const store = new Map<string, string>();
  const adapter: StorageAdapter = {
    getItem: async (k) => store.get(k) ?? null,
    setItem: async (k, v) => {
      store.set(k, v);
    },
    removeItem: async (k) => {
      store.delete(k);
    },
    multiRemove: async (ks) => {
      ks.forEach((k) => store.delete(k));
    },
  };
  return { adapter, store };
}

describe("clearDistributorBreaker", () => {
  it("clears the entry from the adapter it is given", async () => {
    // The Settings "Re-enable" action passes the same adapter its health/fetch
    // path writes the breaker with. Clearing the wrong store (the default
    // IndexedDB adapter in a Tauri webview) left the real breaker in cooldown.
    const { adapter, store } = makeAdapter();
    const store1 = createStorageBreakerStore(adapter);
    await store1.set({
      distributorId: "server2u-my",
      status: "blocked",
      consecutiveFailures: 3,
      lastAttemptAt: Date.now(),
      cooldownUntil: Date.now() + 60_000,
    });
    expect(await store1.get("server2u-my")).not.toBeNull();

    await clearDistributorBreaker("server2u-my", adapter);

    expect(await store1.get("server2u-my")).toBeNull();
    // The persisted list no longer names the distributor.
    const raw = store.get(DISTRIBUTOR_BREAKER_KEY) ?? "[]";
    expect(raw).not.toContain("server2u-my");
  });

  it("is a no-op for a distributor with no breaker entry", async () => {
    const { adapter } = makeAdapter();
    await expect(
      clearDistributorBreaker("never-seen", adapter),
    ).resolves.toBeUndefined();
  });
});

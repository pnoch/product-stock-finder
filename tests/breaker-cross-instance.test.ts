import { describe, expect, it } from "vitest";
import { createStorageBreakerStore } from "../lib/scrapers/resilient";
import type { BreakerEntry } from "../lib/scrapers/resilient";

function makeAdapter() {
  const store = new Map<string, string>();
  return {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      // Yield so interleaving is possible without serialization.
      await new Promise((r) => setTimeout(r, 1));
      store.set(k, v);
    },
    store,
  };
}

function entry(distributorId: string): BreakerEntry {
  return {
    distributorId,
    status: "error",
    consecutiveFailures: 1,
    lastAttemptAt: 1,
    cooldownUntil: 0,
  };
}

describe("breaker store cross-instance serialization", () => {
  it("does not lose entries written by a different store instance", async () => {
    const adapter = makeAdapter();
    const a = createStorageBreakerStore(adapter);
    const b = createStorageBreakerStore(adapter);

    // Two instances write different distributors concurrently.
    await Promise.all([a.set(entry("d1")), b.set(entry("d2"))]);

    const raw = adapter.store.get("distributor_breaker");
    const list = JSON.parse(raw!) as BreakerEntry[];
    expect(list.map((e) => e.distributorId).sort()).toEqual(["d1", "d2"]);
  });
});

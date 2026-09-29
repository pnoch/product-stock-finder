import { describe, expect, it, vi } from "vitest";
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

// A fresh module instance per "session": `quarantineKeys` is module memory and
// is empty after a real reload, which is exactly the condition that orphaned
// earlier blobs.
async function freshContext() {
  vi.resetModules();
  return import("../lib/storage/context");
}

describe("quarantine index persistence", () => {
  it("does not orphan blobs quarantined in an earlier session", async () => {
    const { adapter, store } = makeAdapter();

    // Session 1: two blobs.
    const s1 = await freshContext();
    await s1.quarantinePayload(adapter, "watchlist_products", "corrupt-1");
    await s1.quarantinePayload(adapter, "price_alerts", "corrupt-2");
    const before = await s1.listQuarantinedKeys(adapter);
    expect(before).toHaveLength(2);

    // Session 2 (reload): module memory is empty; a new quarantine must not
    // drop the earlier blobs from the persisted index.
    const s2 = await freshContext();
    await s2.quarantinePayload(adapter, "app_settings", "corrupt-3");
    const after = await s2.listQuarantinedKeys(adapter);
    for (const key of before) {
      expect(after, `orphaned ${key}`).toContain(key);
    }
    expect(after).toHaveLength(3);
    for (const key of after) {
      expect(store.has(key), `missing blob ${key}`).toBe(true);
    }
  });

  it("bounds the persisted index", async () => {
    const { adapter } = makeAdapter();
    const ctx = await freshContext();
    for (let i = 0; i < 40; i++) {
      await ctx.quarantinePayload(adapter, `key_${i}`, `corrupt-${i}`);
    }
    const keys = await ctx.listQuarantinedKeys(adapter);
    expect(keys.length).toBeLessThanOrEqual(30);
    expect(keys.some((k) => k.includes("key_39"))).toBe(true);
  });
});

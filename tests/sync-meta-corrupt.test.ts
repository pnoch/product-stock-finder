import { describe, expect, it } from "vitest";
import { createStorage, type Storage } from "../lib/storage";

// A corrupt/legacy sync_meta payload must not be treated as valid: a bogus
// cursor would make the next sync incremental and silently skip items.
function storageWith(raw: string | null): Storage {
  const store = new Map<string, string>();
  if (raw !== null) store.set("sync_meta", raw);
  return createStorage({
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: async (k: string) => {
      store.delete(k);
    },
    multiRemove: async (keys: string[]) => {
      keys.forEach((k) => store.delete(k));
    },
  });
}

describe("corrupt sync_meta payloads", () => {
  it("falls back to an empty meta for a non-object payload", async () => {
    for (const raw of ["[]", '"a string"', "42", "null"]) {
      const meta = await storageWith(raw).getSyncMeta();
      expect(meta.lastSyncedAt, raw).toBe(0);
      expect(meta.items, raw).toEqual({});
    }
  });

  it("falls back to an empty meta for invalid JSON", async () => {
    const meta = await storageWith("{not json").getSyncMeta();
    expect(meta.lastSyncedAt).toBe(0);
    expect(meta.items).toEqual({});
  });

  it("rejects a non-numeric lastSyncedAt rather than trusting it", async () => {
    const meta = await storageWith(
      JSON.stringify({ lastSyncedAt: "not-a-number", items: {} }),
    ).getSyncMeta();
    expect(meta.lastSyncedAt).toBe(0);
  });

  it("rejects a non-object items map", async () => {
    const meta = await storageWith(
      JSON.stringify({ lastSyncedAt: 5, items: [] }),
    ).getSyncMeta();
    expect(meta.lastSyncedAt).toBe(0);
    expect(meta.items).toEqual({});
  });

  it("keeps a valid payload", async () => {
    const meta = await storageWith(
      JSON.stringify({ lastSyncedAt: 1234, items: { watchlist: {} } }),
    ).getSyncMeta();
    expect(meta.lastSyncedAt).toBe(1234);
    expect(meta.items).toEqual({ watchlist: {} });
  });
});

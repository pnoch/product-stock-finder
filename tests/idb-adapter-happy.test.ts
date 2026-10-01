import { afterEach, describe, expect, it, vi } from "vitest";

// Minimal in-memory IndexedDB stand-in covering the exact surface the adapter
// uses (open → transaction → objectStore → get/put/delete + oncomplete).
function fakeIDB(opts: {
  containsStore?: boolean;
  failPut?: boolean;
  txFail?: "abort" | "error";
} = {}) {
  const data = new Map<string, string>();
  const createObjectStore = vi.fn();
  const removeCalls: string[] = [];

  const db = {
    objectStoreNames: { contains: () => opts.containsStore ?? true },
    createObjectStore,
    close: vi.fn(),
    transaction: (_name: string, _mode: string) => {
      const tx: Record<string, unknown> = {};
      const finish = () => {
        if (opts.txFail === "abort") {
          tx.error = new Error("transaction aborted");
          (tx.onabort as (() => void) | undefined)?.();
        } else if (opts.txFail === "error") {
          tx.error = new Error("transaction failed");
          (tx.onerror as (() => void) | undefined)?.();
        } else {
          (tx.oncomplete as (() => void) | undefined)?.();
        }
      };
      tx.objectStore = () => ({
        get: (key: string) => {
          const req: Record<string, unknown> = {};
          queueMicrotask(() => {
            req.result = data.has(key) ? { key, value: data.get(key) } : undefined;
            (req.onsuccess as (() => void) | undefined)?.();
            queueMicrotask(finish);
          });
          return req;
        },
        put: ({ key, value }: { key: string; value: string }) => {
          const req: Record<string, unknown> = {};
          queueMicrotask(() => {
            if (opts.failPut) {
              (req.onerror as (() => void) | undefined)?.();
              return;
            }
            data.set(key, value);
            req.result = key;
            (req.onsuccess as (() => void) | undefined)?.();
            queueMicrotask(finish);
          });
          return req;
        },
        delete: (key: string) => {
          const req: Record<string, unknown> = {};
          removeCalls.push(key);
          queueMicrotask(() => {
            data.delete(key);
            (req.onsuccess as (() => void) | undefined)?.();
            queueMicrotask(finish);
          });
          return req;
        },
      });
      return tx;
    },
  };

  const indexedDB = {
    open: () => {
      const req: Record<string, unknown> = {};
      queueMicrotask(() => {
        req.result = db;
        (req.onupgradeneeded as (() => void) | undefined)?.();
        (req.onsuccess as (() => void) | undefined)?.();
      });
      return req;
    },
  };

  return { data, db, indexedDB, createObjectStore, removeCalls };
}

function lsBackedBy(map: Map<string, string>) {
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("idb-adapter happy paths", () => {
  it("stores a value in IDB and clears the localStorage shadow", async () => {
    const fake = fakeIDB();
    const ls = new Map<string, string>([["k", "stale"]]);
    vi.stubGlobal("indexedDB", fake.indexedDB);
    vi.stubGlobal("localStorage", lsBackedBy(ls));

    const { createIDBAdapter } = await import("../lib/storage/idb-adapter");
    const adapter = createIDBAdapter();

    await adapter.setItem("k", "v");
    expect(fake.data.get("k")).toBe("v");
    expect(ls.has("k")).toBe(false);
    expect(await adapter.getItem("k")).toBe("v");
  });

  it("creates the object store on upgrade", async () => {
    const fake = fakeIDB({ containsStore: false });
    vi.stubGlobal("indexedDB", fake.indexedDB);
    vi.stubGlobal("localStorage", lsBackedBy(new Map()));

    const { createIDBAdapter } = await import("../lib/storage/idb-adapter");
    await createIDBAdapter().getItem("missing");
    expect(fake.createObjectStore).toHaveBeenCalledWith("kv", { keyPath: "key" });
  });

  it("adopts a legacy localStorage value into IDB on a miss", async () => {
    const fake = fakeIDB();
    const ls = new Map<string, string>([["watchlist_products", "[1,2,3]"]]);
    vi.stubGlobal("indexedDB", fake.indexedDB);
    vi.stubGlobal("localStorage", lsBackedBy(ls));

    const { createIDBAdapter } = await import("../lib/storage/idb-adapter");
    const adapter = createIDBAdapter();

    expect(await adapter.getItem("watchlist_products")).toBe("[1,2,3]");
    expect(fake.data.get("watchlist_products")).toBe("[1,2,3]");
    expect(ls.has("watchlist_products")).toBe(false);
  });

  it("keeps the localStorage copy and still returns it when migration fails", async () => {
    const fake = fakeIDB({ failPut: true });
    const ls = new Map<string, string>([["legacy", "value"]]);
    vi.stubGlobal("indexedDB", fake.indexedDB);
    vi.stubGlobal("localStorage", lsBackedBy(ls));

    const { createIDBAdapter } = await import("../lib/storage/idb-adapter");
    const adapter = createIDBAdapter();

    expect(await adapter.getItem("legacy")).toBe("value");
    expect(ls.get("legacy")).toBe("value");
  });

  it("returns null when neither store has the key (IDB available)", async () => {
    const fake = fakeIDB();
    vi.stubGlobal("indexedDB", fake.indexedDB);
    vi.stubGlobal("localStorage", lsBackedBy(new Map()));

    const { createIDBAdapter } = await import("../lib/storage/idb-adapter");
    expect(await createIDBAdapter().getItem("missing")).toBeNull();
  });

  it("deletes from IDB then clears the localStorage copy", async () => {
    const fake = fakeIDB();
    fake.data.set("k", "v");
    const ls = new Map<string, string>([["k", "v"]]);
    vi.stubGlobal("indexedDB", fake.indexedDB);
    vi.stubGlobal("localStorage", lsBackedBy(ls));

    const { createIDBAdapter } = await import("../lib/storage/idb-adapter");
    await createIDBAdapter().removeItem("k");
    expect(fake.data.has("k")).toBe(false);
    expect(ls.has("k")).toBe(false);
  });

  it("multiRemove deletes every key from both stores", async () => {
    const fake = fakeIDB();
    fake.data.set("a", "1");
    fake.data.set("b", "2");
    const ls = new Map<string, string>([
      ["a", "1"],
      ["b", "2"],
    ]);
    vi.stubGlobal("indexedDB", fake.indexedDB);
    vi.stubGlobal("localStorage", lsBackedBy(ls));

    const { createIDBAdapter } = await import("../lib/storage/idb-adapter");
    await createIDBAdapter().multiRemove(["a", "b"]);
    expect(fake.data.size).toBe(0);
    expect(ls.size).toBe(0);
  });
});

describe("idb-adapter commit failures", () => {
  it("rejects setItem when the write transaction aborts", async () => {
    const fake = fakeIDB({ txFail: "abort" });
    vi.stubGlobal("indexedDB", fake.indexedDB);
    vi.stubGlobal("localStorage", lsBackedBy(new Map()));
    const { createIDBAdapter } = await import("../lib/storage/idb-adapter");
    await expect(createIDBAdapter().setItem("k", "v")).rejects.toThrow(
      /abort/i,
    );
  });

  it("rejects setItem when the write transaction errors", async () => {
    const fake = fakeIDB({ txFail: "error" });
    vi.stubGlobal("indexedDB", fake.indexedDB);
    vi.stubGlobal("localStorage", lsBackedBy(new Map()));
    const { createIDBAdapter } = await import("../lib/storage/idb-adapter");
    await expect(createIDBAdapter().setItem("k", "v")).rejects.toThrow();
  });

  it("rejects multiRemove when the transaction aborts", async () => {
    const fake = fakeIDB({ txFail: "abort" });
    vi.stubGlobal("indexedDB", fake.indexedDB);
    vi.stubGlobal("localStorage", lsBackedBy(new Map()));
    const { createIDBAdapter } = await import("../lib/storage/idb-adapter");
    await expect(createIDBAdapter().multiRemove(["a"])).rejects.toThrow(
      /abort/i,
    );
  });
});

describe("isIndexedDBAvailable", () => {
  it("requires both indexedDB and window", async () => {
    const { isIndexedDBAvailable } = await import("../lib/storage/idb-adapter");
    vi.stubGlobal("indexedDB", {});
    vi.stubGlobal("window", {});
    expect(isIndexedDBAvailable()).toBe(true);
    vi.stubGlobal("indexedDB", undefined);
    expect(isIndexedDBAvailable()).toBe(false);
    vi.stubGlobal("indexedDB", {});
    vi.stubGlobal("window", undefined);
    expect(isIndexedDBAvailable()).toBe(false);
  });
});

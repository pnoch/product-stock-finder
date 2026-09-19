import { describe, expect, it, vi, afterEach } from "vitest";

function stubFailingBackends() {
  vi.stubGlobal("indexedDB", undefined);
  const failure = () => {
    throw new Error("storage unavailable");
  };
  vi.stubGlobal("localStorage", {
    getItem: failure,
    setItem: failure,
    removeItem: failure,
  });
}

describe("idb-adapter remove paths", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not throw when removeItem fails everywhere", async () => {
    stubFailingBackends();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { createIDBAdapter } = await import("../lib/storage/idb-adapter");
    const adapter = createIDBAdapter();
    await expect(adapter.removeItem("k")).resolves.toBeUndefined();
  });

  it("does not throw when multiRemove fails everywhere", async () => {
    stubFailingBackends();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { createIDBAdapter } = await import("../lib/storage/idb-adapter");
    const adapter = createIDBAdapter();
    await expect(adapter.multiRemove(["a", "b"])).resolves.toBeUndefined();
  });
});

describe("idb-adapter setItem durability", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("surfaces a real IDB write failure instead of shadowing it", async () => {
    // A quota/abort failure must NOT silently fall back to localStorage:
    // getItem prefers IDB, so the stale IDB value would shadow the new write.
    const failingDb = {
      transaction: () => {
        const tx: Record<string, unknown> = {};
        const req: Record<string, unknown> = {};
        // Fail the request asynchronously, after handlers are attached.
        setTimeout(() => {
          (req.onerror as (() => void) | undefined)?.();
        }, 0);
        tx.objectStore = () => ({
          put: () => req,
          delete: () => req,
          get: () => req,
        });
        return tx;
      },
      close: () => {},
    };
    vi.stubGlobal("indexedDB", {
      open: () => {
        const openReq: Record<string, unknown> = {};
        setTimeout(() => {
          (openReq.onsuccess as (() => void) | undefined)?.();
        }, 0);
        return Object.assign(openReq, { result: failingDb });
      },
    });
    const lsSet = vi.fn();
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: lsSet,
      removeItem: () => {},
    });
    const { createIDBAdapter } = await import("../lib/storage/idb-adapter");
    const adapter = createIDBAdapter();
    await expect(adapter.setItem("k", "v")).rejects.toBeTruthy();
    // Must not have written the fallback copy (which would be shadowed).
    expect(lsSet).not.toHaveBeenCalled();
  });
});

describe("idb-adapter localStorage migration", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("adopts a legacy localStorage value on an IndexedDB miss", async () => {
    // No IDB at all → reads/writes fall back to localStorage.
    vi.stubGlobal("indexedDB", undefined);
    const store = new Map<string, string>([["watchlist_products", "[1,2,3]"]]);
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    const { createIDBAdapter } = await import("../lib/storage/idb-adapter");
    const adapter = createIDBAdapter();
    expect(await adapter.getItem("watchlist_products")).toBe("[1,2,3]");
  });

  it("returns null when neither store has the key", async () => {
    vi.stubGlobal("indexedDB", undefined);
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
    const { createIDBAdapter } = await import("../lib/storage/idb-adapter");
    const adapter = createIDBAdapter();
    expect(await adapter.getItem("missing")).toBeNull();
  });
});

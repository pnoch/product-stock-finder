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

  it("warns and rethrows when removeItem fails everywhere", async () => {
    stubFailingBackends();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { createIDBAdapter } = await import("../lib/storage/idb-adapter");
    const adapter = createIDBAdapter();
    await expect(adapter.removeItem("k")).rejects.toThrow("storage unavailable");
    expect(warn).toHaveBeenCalledWith(
      "[idb-adapter] removeItem fallback failed",
      expect.anything(),
    );
  });

  it("warns and rethrows when multiRemove fails everywhere", async () => {
    stubFailingBackends();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { createIDBAdapter } = await import("../lib/storage/idb-adapter");
    const adapter = createIDBAdapter();
    await expect(adapter.multiRemove(["a", "b"])).rejects.toThrow("storage unavailable");
    expect(warn).toHaveBeenCalledWith(
      "[idb-adapter] multiRemove fallback failed",
      expect.anything(),
    );
  });
});

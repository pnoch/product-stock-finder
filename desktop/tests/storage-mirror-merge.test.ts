import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn(async () => "[]"));

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => !!(globalThis as unknown as { isTauri?: boolean }).isTauri, invoke: invokeMock }));

const product = {
  id: "p1",
  name: "Product 1",
  modelNumber: "CRS804",
  brand: "MikroTik",
  category: "Switch",
  description: "",
  addedAt: "2026-01-01T00:00:00.000Z",
  isWatched: true,
  listings: [],
};

async function loadStorage() {
  vi.resetModules();
  (window as unknown as { isTauri?: boolean }).isTauri = true;
  return import("../src/storage");
}

describe("desktop watchlist mirror", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    delete (window as unknown as { isTauri?: boolean }).isTauri;
  });

  it("merges the watchlist into the file store instead of overwriting it", async () => {
    const { storage } = await loadStorage();
    await storage.saveWatchlist([product] as never);
    expect(invokeMock).toHaveBeenCalledWith("merge_watchlist", {
      value: [product],
    });
  });

  it("still uses the plain setter for the other mirrored keys", async () => {
    const { storage } = await loadStorage();
    await storage.saveAlerts([] as never);
    expect(invokeMock).toHaveBeenCalledWith("set_value_for_key", {
      key: "price_alerts",
      value: [],
    });
  });

  it("writes the merged array back to localStorage", async () => {
    invokeMock.mockResolvedValueOnce(JSON.stringify([{ id: "merged" }]));
    const { storage } = await loadStorage();
    await storage.saveWatchlist([product] as never);
    expect(localStorage.getItem("watchlist_products")).toBe(
      JSON.stringify([{ id: "merged" }]),
    );
  });
});

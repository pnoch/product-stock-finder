import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const invokeMock = vi.hoisted(() =>
  vi.fn<(cmd: string, args?: unknown) => Promise<unknown>>(),
);

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
    invokeMock.mockResolvedValue("[]");
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
    await storage.saveBackOrderReminders([] as never);
    expect(invokeMock).toHaveBeenCalledWith("set_value_for_key", {
      key: "back_order_reminders",
      value: [],
    });
  });

  it("sends per-item alert mutations instead of overwriting the array", async () => {
    const { storage } = await loadStorage();
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "read_value_for_key") return [{ id: "a1", targetPrice: 500 }];
      if (cmd === "apply_alert_mutations") {
        return JSON.stringify([{ id: "a1", targetPrice: 450 }]);
      }
      return "[]";
    });
    await storage.saveAlerts([{ id: "a1", targetPrice: 450 }] as never);
    expect(invokeMock).toHaveBeenCalledWith("apply_alert_mutations", {
      upserts: [{ id: "a1", patch: { targetPrice: 450 } }],
      removes: [],
    });
    expect(invokeMock).not.toHaveBeenCalledWith(
      "set_value_for_key",
      expect.objectContaining({ key: "price_alerts" }),
    );
  });

  it("reads alerts from the file store", async () => {
    const { storage } = await loadStorage();
    invokeMock.mockImplementation(async (cmd: string) =>
      cmd === "read_value_for_key" ? [{ id: "a1" }] : "[]",
    );
    const alerts = await storage.getAlerts();
    expect(invokeMock).toHaveBeenCalledWith("read_value_for_key", { key: "price_alerts" });
    expect(alerts).toEqual([{ id: "a1" }]);
  });

  it("writes the merged array back to localStorage", async () => {
    invokeMock.mockResolvedValueOnce(JSON.stringify([{ id: "merged" }]));
    const { storage } = await loadStorage();
    await storage.saveWatchlist([product] as never);
    expect(localStorage.getItem("watchlist_products")).toBe(
      JSON.stringify([{ id: "merged" }]),
    );
  });

  it("does not invoke the mutation command when a save changes nothing", async () => {
    const { storage } = await loadStorage();
    invokeMock.mockImplementation(async (cmd: string) =>
      cmd === "read_value_for_key" ? [{ id: "a1", targetPrice: 500 }] : "[]",
    );
    await storage.saveAlerts([{ id: "a1", targetPrice: 500 }] as never);
    expect(invokeMock).not.toHaveBeenCalledWith(
      "apply_alert_mutations",
      expect.anything(),
    );
  });

  it("sends removes and writes the merged array back to localStorage", async () => {
    const { storage } = await loadStorage();
    invokeMock.mockImplementation(async (cmd: string) => {
      if (cmd === "read_value_for_key") return [{ id: "a1" }];
      if (cmd === "apply_alert_mutations") return JSON.stringify([]);
      return "[]";
    });
    await storage.getAlerts(); // seeds the diff baseline from the file
    await storage.saveAlerts([] as never);
    expect(invokeMock).toHaveBeenCalledWith("apply_alert_mutations", {
      upserts: [],
      removes: ["a1"],
    });
    expect(localStorage.getItem("price_alerts")).toBe(JSON.stringify([]));
  });
});

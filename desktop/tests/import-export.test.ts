import { describe, it, expect, vi, beforeEach } from "vitest";
import { importWatchlistFromJson } from "../src/import-export";

const state = vi.hoisted(() => ({
  savedWatches: [] as unknown[],
  savedWatchlist: [] as unknown[],
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(async () => "/tmp/import.json"),
  save: vi.fn(async () => "/tmp/export.json"),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: vi.fn(async () => new TextEncoder().encode("{}")),
  writeFile: vi.fn(async () => {}),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string, args?: Record<string, unknown>) => {
    if (cmd === "import_watchlist") return "Imported";
    if (cmd === "export_watchlist") return "{}";
    if (cmd === "read_watchlist") return [{ id: "p1" }];
    if (cmd === "read_value_for_key") {
      const key = (args as { key: string }).key;
      if (key === "price_alerts") return [];
      if (key === "back_order_reminders") return [];
      if (key === "back_in_stock_watches") return [{ id: "w1" }];
      if (key === "app_settings") return { theme: "auto" };
    }
    return null;
  }),
}));

vi.mock("../src/storage", () => ({
  storage: {
    saveWatchlist: vi.fn(async (v: unknown) => {
      state.savedWatchlist.push(v);
    }),
    saveAlerts: vi.fn(async () => {}),
    saveBackOrderReminders: vi.fn(async () => {}),
    saveStockWatches: vi.fn(async (v: unknown) => {
      state.savedWatches.push(v);
    }),
    saveSettings: vi.fn(async () => {}),
  },
}));

// QA round 302: the native import's renderer rehydrate read four keys, but the
// Rust import also writes `back_in_stock_watches` — so imported restock watches
// never reached localStorage and the next renderer write mirrored the stale
// pre-import watches back over the import.
describe("importWatchlistFromJson", () => {
  beforeEach(() => {
    state.savedWatches = [];
    state.savedWatchlist = [];
  });

  it("rehydrates restock watches alongside the other collections", async () => {
    const message = await importWatchlistFromJson();
    expect(message).toBe("Imported");
    expect(state.savedWatchlist).toEqual([[{ id: "p1" }]]);
    expect(state.savedWatches).toEqual([[{ id: "w1" }]]);
  });
});

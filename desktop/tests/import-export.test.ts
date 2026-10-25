import { describe, it, expect, vi, beforeEach } from "vitest";
import { importWatchlistFromJson } from "../src/import-export";

const state = vi.hoisted(() => ({
  savedWatches: [] as unknown[],
  savedWatchlist: [] as unknown[],
  content: "",
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(async () => "/tmp/import.json"),
  save: vi.fn(async () => "/tmp/export.json"),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: vi.fn(async () => new TextEncoder().encode(state.content)),
  writeFile: vi.fn(async () => {}),
}));

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => !!(globalThis as unknown as { isTauri?: boolean }).isTauri,
  invoke: vi.fn(async (cmd: string) => {
    if (cmd === "export_watchlist") return "{}";
    return null;
  }),
}));

vi.mock("../src/storage", () => ({
  storage: {
    getWatchlist: vi.fn(async () => [
      { id: "p1", name: "Local only" },
    ]),
    getAlerts: vi.fn(async () => []),
    getBackOrderReminders: vi.fn(async () => []),
    getStockWatches: vi.fn(async () => []),
    getSettings: vi.fn(async () => ({ theme: "auto" })),
    saveWatchlist: vi.fn(async (v: unknown) => {
      state.savedWatchlist.push(v);
    }),
    saveAlerts: vi.fn(async () => {}),
    saveBackOrderReminders: vi.fn(async () => {}),
    saveStockWatches: vi.fn(async (v: unknown) => {
      state.savedWatches.push(v);
    }),
    saveSettings: vi.fn(async () => {}),
    setItemSyncMeta: vi.fn(async () => {}),
  },
}));

function backupWith(products: unknown[]): string {
  return JSON.stringify({
    format: "product-stock-finder-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    watchlist: products,
    alerts: [],
    reminders: [],
    stockWatches: [],
  });
}

// The Tauri path used to delegate to a Rust command that replaced every
// collection wholesale, deleting local-only products while the browser path
// merged. Both platforms now merge.
describe("importWatchlistFromJson (Tauri)", () => {
  beforeEach(() => {
    state.savedWatches = [];
    state.savedWatchlist = [];
    (globalThis as unknown as { isTauri?: boolean }).isTauri = true;
  });

  it("merges the backup with local data instead of replacing it", async () => {
    state.content = backupWith([{ id: "p2", name: "Imported" }]);
    const message = await importWatchlistFromJson();
    expect(message).toBe("Imported 1 new product");
    const saved = state.savedWatchlist[0] as { id: string }[];
    expect(saved.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
  });

  it("rejects an invalid backup without saving", async () => {
    state.content = "{}";
    await expect(importWatchlistFromJson()).resolves.toBe("Invalid backup file");
    expect(state.savedWatchlist).toHaveLength(0);
  });
});

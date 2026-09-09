import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import {
  BACKUP_FORMAT,
  applyBackup,
  buildBackup,
  parseBackup,
} from "../lib/backup";

describe("desktop full backup", () => {
  it("round-trips through build/parse/apply with merge counts", () => {
    const current = {
      watchlist: [],
      alerts: [],
      reminders: [],
      stockWatches: [],
      settings: { displayCurrency: "USD" } as never,
    };
    const incoming = {
      watchlist: [{ id: "p1", name: "Widget", listings: [] }],
      alerts: [],
      reminders: [],
      stockWatches: [],
      settings: { displayCurrency: "EUR" } as never,
    };
    const json = buildBackup(incoming as never);
    const parsed = parseBackup(json);
    if (!parsed) throw new Error("round-trip parse failed");
    expect(parsed.format).toBe(BACKUP_FORMAT);
    const result = applyBackup(parsed, current as never);
    expect(result.counts.watchlistAdded).toBe(1);
    expect(result.watchlist).toHaveLength(1);
  });

  it("wires export/import buttons with sync-meta stamping", async () => {
    const text = await readFile("desktop/src/pages/Settings.tsx", "utf8");
    expect(text).toContain("Export full backup");
    expect(text).toContain("Import backup");
    expect(text).toContain("setItemSyncMeta");
  });
});

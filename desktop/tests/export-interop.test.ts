import { describe, expect, it } from "vitest";
import { parseBackup, BACKUP_FORMAT } from "../../lib/backup";

// The Rust export/import wire shape is aligned with lib/backup.ts's BackupData
// (camelCase + `format`), so a desktop export can be restored by the shared
// parser (mobile/web) and vice versa. The Rust side is covered by its own unit
// tests; this pins the shared half of the contract.
describe("desktop export interops with the shared backup parser", () => {
  it("parses a desktop-shaped export", () => {
    const json = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: "2026-01-01T00:00:00.000Z",
      watchlist: [],
      alerts: [],
      reminders: [],
      stockWatches: [],
      settings: { displayCurrency: "EUR" },
    });
    const parsed = parseBackup(json);
    expect(parsed).not.toBeNull();
    expect(parsed!.exportedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(parsed!.settings?.displayCurrency).toBe("EUR");
  });

  it("still rejects the pre-fix snake_case desktop shape", () => {
    // Legacy files load through the Rust importer (which has snake_case
    // aliases); the shared parser never accepted them.
    const legacy = JSON.stringify({
      version: 1,
      exported_at: "2026-01-01T00:00:00.000Z",
      watchlist: [],
      alerts: [],
      reminders: [],
      stock_watches: [],
      settings: {},
    });
    expect(parseBackup(legacy)).toBeNull();
  });
});

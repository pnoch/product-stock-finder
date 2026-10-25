import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { storage } from "./storage";
import { isTauri } from "./lib/tauri";
import { applyBackup, buildBackup, parseBackup } from "../../lib/backup";

const EXPORT_FILENAME = "product-stock-finder-export.json";

async function readCurrentBackupInput() {
  const [watchlist, alerts, reminders, stockWatches, settings] =
    await Promise.all([
      storage.getWatchlist(),
      storage.getAlerts(),
      storage.getBackOrderReminders(),
      storage.getStockWatches(),
      storage.getSettings(),
    ]);
  return { watchlist, alerts, reminders, stockWatches, settings };
}

function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function pickTextFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      file.text().then(resolve, () => resolve(null));
    };
    input.click();
  });
}

export async function exportWatchlistAsJson(): Promise<string> {
  if (!isTauri()) {
    const content = buildBackup(await readCurrentBackupInput());
    downloadText(EXPORT_FILENAME, content);
    return `Exported ${EXPORT_FILENAME}`;
  }

  const content = await invoke<string>("export_watchlist", { format: "json" });

  const filePath = await save({
    defaultPath: EXPORT_FILENAME,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (filePath) {
    const encoder = new TextEncoder();
    await writeFile(filePath, encoder.encode(content));
    return `Exported to ${filePath}`;
  }
  return "Export cancelled";
}

async function applyImportedContent(content: string): Promise<string> {
  const backup = parseBackup(content);
  if (!backup) return "Invalid backup file";
  // Merge, never replace: the Tauri path used to call a Rust command that
  // rewrote every collection wholesale, silently deleting local-only products,
  // alerts, and reminders. Both platforms now use the same merge.
  const current = await readCurrentBackupInput();
  const result = applyBackup(backup, current);
  // Stamp each collection's sync meta right after its save so imported data
  // reaches the server on the next sync (mirrors the Settings import path).
  const now = Date.now();
  await storage.saveWatchlist(result.watchlist);
  for (const id of result.touchedIds.watchlist) {
    await storage.setItemSyncMeta("watchlist", id, now);
  }
  await storage.saveAlerts(result.alerts);
  for (const id of result.touchedIds.alerts) {
    await storage.setItemSyncMeta("alerts", id, now);
  }
  await storage.saveBackOrderReminders(result.reminders);
  for (const id of result.touchedIds.reminders) {
    await storage.setItemSyncMeta("reminders", id, now);
  }
  await storage.saveStockWatches(result.stockWatches);
  for (const id of result.touchedIds.stockWatches) {
    await storage.setItemSyncMeta("reminders", id, now);
  }
  if (result.settingsApplied) await storage.saveSettings(result.settings);
  return `Imported ${result.counts.watchlistAdded} new product${
    result.counts.watchlistAdded === 1 ? "" : "s"
  }`;
}

export async function importWatchlistFromJson(): Promise<string> {
  if (!isTauri()) {
    const content = await pickTextFile();
    if (content === null) return "Import cancelled";
    return applyImportedContent(content);
  }

  const filePath = await open({
    filters: [{ name: "JSON", extensions: ["json"] }],
    multiple: false,
  });
  if (!filePath) return "Import cancelled";

  const bytes = await readFile(filePath as string);
  return applyImportedContent(new TextDecoder().decode(bytes));
}

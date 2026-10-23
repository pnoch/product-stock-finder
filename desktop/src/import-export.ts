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

export async function importWatchlistFromJson(): Promise<string> {
  if (!isTauri()) {
    const content = await pickTextFile();
    if (content === null) return "Import cancelled";
    const backup = parseBackup(content);
    if (!backup) return "Invalid backup file";
    const current = await readCurrentBackupInput();
    const result = applyBackup(backup, current);
    await storage.saveWatchlist(result.watchlist);
    await storage.saveAlerts(result.alerts);
    await storage.saveBackOrderReminders(result.reminders);
    await storage.saveStockWatches(result.stockWatches);
    if (result.settingsApplied) await storage.saveSettings(result.settings);
    return `Imported ${result.counts.watchlistAdded} new product${
      result.counts.watchlistAdded === 1 ? "" : "s"
    }`;
  }

  const filePath = await open({
    filters: [{ name: "JSON", extensions: ["json"] }],
    multiple: false,
  });

  if (filePath) {
    const bytes = await readFile(filePath as string);
    const content = new TextDecoder().decode(bytes);
    const result = await invoke<string>("import_watchlist", {
      content,
      format: "json",
    });
    // Re-hydrate the renderer store from the imported Rust files. Without this
    // the UI kept its pre-import localStorage copy and the next write mirrored
    // that stale copy back over the import.
    try {
      const { invoke: inv } = await import("@tauri-apps/api/core");
      const [watchlist, alerts, reminders, settings, watches] = await Promise.all([
        inv<unknown>("read_watchlist"),
        inv<unknown>("read_value_for_key", { key: "price_alerts" }),
        inv<unknown>("read_value_for_key", { key: "back_order_reminders" }),
        inv<unknown>("read_value_for_key", { key: "app_settings" }),
        // The Rust import writes back_in_stock_watches too; omitting it left the
        // renderer's pre-import watches in place, and the next renderer write
        // mirrored that stale copy back over the import.
        inv<unknown>("read_value_for_key", { key: "back_in_stock_watches" }),
      ]);
      if (watchlist) {
        await storage.saveWatchlist(
          (Array.isArray(watchlist) ? watchlist : []) as never,
        );
      }
      if (alerts) await storage.saveAlerts((alerts ?? []) as never);
      if (reminders) {
        await storage.saveBackOrderReminders((reminders ?? []) as never);
      }
      if (watches) await storage.saveStockWatches((watches ?? []) as never);
      if (settings) await storage.saveSettings(settings as never);
    } catch {
      // best effort — the Rust files are the source of truth for the poller
    }
    return result;
  }
  return "Import cancelled";
}

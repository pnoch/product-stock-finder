import { useCallback, useState } from "react";
import { Download, Upload } from "lucide-react";
import { storage } from "../../storage";
import { isTauri } from "../../lib/tauri";
import { saveCsv } from "../../lib/save-csv";
import {
  exportWatchlistAsJson,
  importWatchlistFromJson,
} from "../../import-export";
import { buildBackup, parseBackup, applyBackup } from "../../../../lib/backup";
import { watchlistToCsv } from "../../../../lib/csv";

export function DataSettingsSection() {
  const [importExportMessage, setImportExportMessage] = useState<string | null>(
    null,
  );

  const handleExport = async () => {
    try {
      const result = await exportWatchlistAsJson();
      setImportExportMessage(result);
    } catch {
      setImportExportMessage("Export failed");
    }
  };

  const handleImport = async () => {
    try {
      const result = await importWatchlistFromJson();
      setImportExportMessage(result);
    } catch {
      setImportExportMessage("Import failed");
    }
  };

  const handleExportCsv = useCallback(async () => {
    try {
      const [watchlist, appSettings] = await Promise.all([
        storage.getWatchlist(),
        storage.getSettings(),
      ]);
      const csv = watchlistToCsv(watchlist, appSettings.displayCurrency ?? "USD");
      const fileName = `product-stock-finder-watchlist-${new Date().toISOString().slice(0, 10)}.csv`;
      const result = await saveCsv(fileName, csv);
      if (result.status === "cancelled") {
        setImportExportMessage("Export cancelled");
        return;
      }
      if (result.status === "failed") {
        setImportExportMessage("CSV export failed");
        return;
      }
      setImportExportMessage(result.path ? `Exported to ${result.path}` : "Watchlist exported as CSV");
    } catch (e) {
      setImportExportMessage(e instanceof Error ? e.message : "CSV export failed");
    }
  }, []);

  const handleExportBackup = useCallback(async () => {
    try {
      const [watchlist, alerts, reminders, stockWatches, settings] = await Promise.all([
        storage.getWatchlist(),
        storage.getAlerts(),
        storage.getBackOrderReminders(),
        storage.getStockWatches(),
        storage.getSettings(),
      ]);
      const json = buildBackup({ watchlist, alerts, reminders, stockWatches, settings });
      const fileName = `product-stock-finder-backup-${new Date().toISOString().slice(0, 10)}.json`;
      if (isTauri()) {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const { writeFile } = await import("@tauri-apps/plugin-fs");
        const filePath = await save({ defaultPath: fileName, filters: [{ name: "JSON", extensions: ["json"] }] });
        if (!filePath) {
          setImportExportMessage("Export cancelled");
          return;
        }
        await writeFile(filePath, new TextEncoder().encode(json));
        setImportExportMessage(`Exported to ${filePath}`);
      } else {
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setImportExportMessage("Backup downloaded");
      }
    } catch (e) {
      setImportExportMessage(e instanceof Error ? e.message : "Backup export failed");
    }
  }, []);

  const handleImportBackup = useCallback(async () => {
    try {
      let contents: string | null = null;
      if (isTauri()) {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const { readFile } = await import("@tauri-apps/plugin-fs");
        const picked = await open({ filters: [{ name: "JSON", extensions: ["json"] }], multiple: false });
        if (!picked) {
          setImportExportMessage("Import cancelled");
          return;
        }
        const bytes = await readFile(picked as string);
        contents = new TextDecoder().decode(bytes);
      } else {
        contents = await new Promise<string | null>((resolve) => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "application/json,.json";
          input.onchange = () => {
            const file = input.files?.[0];
            if (!file) {
              resolve(null);
              return;
            }
            const reader = new FileReader();
            reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
            reader.onerror = () => resolve(null);
            reader.readAsText(file);
          };
          input.click();
        });
        if (!contents) {
          setImportExportMessage("Import cancelled");
          return;
        }
      }
      const backup = parseBackup(contents);
      if (!backup) {
        setImportExportMessage("That file is not a valid Product Stock Finder backup.");
        return;
      }
      const [watchlist, alerts, reminders, stockWatches, settings] = await Promise.all([
        storage.getWatchlist(),
        storage.getAlerts(),
        storage.getBackOrderReminders(),
        storage.getStockWatches(),
        storage.getSettings(),
      ]);
      const result = applyBackup(backup, { watchlist, alerts, reminders, stockWatches, settings });
      const summary = [
        `Watchlist: +${result.counts.watchlistAdded} new, ${result.counts.watchlistUpdated} updated`,
        `Alerts: +${result.counts.alertsAdded} new, ${result.counts.alertsUpdated} updated`,
        `Reminders: +${result.counts.remindersAdded} new, ${result.counts.remindersUpdated} updated`,
        `Stock watches: +${result.counts.stockWatchesAdded} new, ${result.counts.stockWatchesUpdated} updated`,
      ].join("\n");
      if (!confirm(`Import Backup?\n\n${summary}`)) return;
      // Re-read and merge at save time: the snapshot above predates the confirm
      // dialog, and a price sweep or sync pull can write the watchlist while the
      // user decides — saving the stale snapshot reverted those changes.
      const [freshWatchlist, freshAlerts, freshReminders, freshWatches, freshSettings] =
        await Promise.all([
          storage.getWatchlist(),
          storage.getAlerts(),
          storage.getBackOrderReminders(),
          storage.getStockWatches(),
          storage.getSettings(),
        ]);
      const fresh = applyBackup(backup, {
        watchlist: freshWatchlist,
        alerts: freshAlerts,
        reminders: freshReminders,
        stockWatches: freshWatches,
        settings: freshSettings,
      });
      const now = Date.now();
      // Stamp each collection's meta right after its save, so a later failure
      // cannot leave imported data that never syncs.
      await storage.saveWatchlist(fresh.watchlist);
      for (const idc of fresh.touchedIds.watchlist) await storage.setItemSyncMeta("watchlist", idc, now);
      await storage.saveAlerts(fresh.alerts);
      for (const idc of fresh.touchedIds.alerts) await storage.setItemSyncMeta("alerts", idc, now);
      await storage.saveBackOrderReminders(fresh.reminders);
      for (const idc of fresh.touchedIds.reminders) await storage.setItemSyncMeta("reminders", idc, now);
      await storage.saveStockWatches(fresh.stockWatches);
      for (const idc of fresh.touchedIds.stockWatches) await storage.setItemSyncMeta("reminders", idc, now);
      if (fresh.settingsApplied) await storage.saveSettings(fresh.settings);
      setImportExportMessage("Backup imported. Reloading…");
      window.location.reload();
    } catch (e) {
      setImportExportMessage(e instanceof Error ? e.message : "Backup import failed");
    }
  }, []);


  return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h2 className="text-lg font-semibold mb-4">Data</h2>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
            aria-label="Export watchlist"
          >
            <Download className="w-4 h-4" /> Export Watchlist
          </button>
          <button
            onClick={handleImport}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            aria-label="Import watchlist"
          >
            <Upload className="w-4 h-4" /> Import Watchlist
          </button>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            aria-label="Export CSV"
            title="Save watchlist as CSV (prices in display currency)"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button
            onClick={handleExportBackup}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium"
            aria-label="Export Backup"
            title="Save watchlist, alerts and settings to a file"
          >
            <Download className="w-4 h-4" /> Export Backup
          </button>
          <button
            onClick={handleImportBackup}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium"
            aria-label="Import Backup"
            title="Restore from a backup file (merges by id)"
          >
            <Upload className="w-4 h-4" /> Import Backup
          </button>
        </div>
        {importExportMessage && (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            {importExportMessage}
          </p>
        )}
      </div>

  );
}

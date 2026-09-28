import { useState } from "react";
import {
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/use-colors";
import { SectionHeader } from "@/components/settings/section-header";
import { SettingRow } from "@/components/settings/setting-row";
import { showAlert } from "@/lib/alert";
import {
  getAlerts,
  getBackOrderReminders,
  getSettings,
  getStockWatches,
  getWatchlist,
  saveAlerts,
  saveBackOrderReminders,
  saveSettings,
  saveStockWatches,
  saveWatchlist,
  setItemSyncMeta,
} from "@/lib/storage";
import { applyBackup, buildBackup, parseBackup } from "@/lib/backup";
import { exportBackupFile, pickBackupFile } from "@/lib/backup-files";
import { watchlistToCsv } from "@/lib/csv";
import { exportCsvFile } from "@/lib/csv-export";

async function performExport(): Promise<boolean> {
  const [watchlist, alerts, reminders, stockWatches, settings] =
    await Promise.all([
      getWatchlist(),
      getAlerts(),
      getBackOrderReminders(),
      getStockWatches(),
      getSettings(),
    ]);
  const json = buildBackup({
    watchlist,
    alerts,
    reminders,
    stockWatches,
    settings,
  });
  return exportBackupFile(json);
}

function tapHaptic() {
  if (Platform.OS !== "web")
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function mergeSummary(counts: {
  watchlistAdded: number;
  watchlistUpdated: number;
  alertsAdded: number;
  alertsUpdated: number;
  remindersAdded: number;
  remindersUpdated: number;
  stockWatchesAdded: number;
  stockWatchesUpdated: number;
}): string {
  return [
    `Watchlist: +${counts.watchlistAdded} new, ${counts.watchlistUpdated} updated`,
    `Alerts: +${counts.alertsAdded} new, ${counts.alertsUpdated} updated`,
    `Reminders: +${counts.remindersAdded} new, ${counts.remindersUpdated} updated`,
    `Stock watches: +${counts.stockWatchesAdded} new, ${counts.stockWatchesUpdated} updated`,
  ].join("\n");
}

export function DataSection() {
  const colors = useColors();
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    tapHaptic();
    setBusy(true);
    try {
      const ok = await performExport();
      showAlert(
        ok ? "Backup Exported" : "Export Failed",
        ok
          ? "Your backup file has been created."
          : "Could not create the backup file on this device.",
      );
    } catch (e) {
      // A storage read failure must not reject unhandled.
      console.error("[DataSection] backup export failed", e);
      showAlert("Export Failed", "We couldn't create your backup. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleExportCsv = async () => {
    tapHaptic();
    setBusy(true);
    try {
      const [watchlist, settings] = await Promise.all([getWatchlist(), getSettings()]);
      const currency = settings?.displayCurrency ?? "USD";
      const csv = watchlistToCsv(watchlist, currency);
      const ok = await exportCsvFile(
        csv,
        `product-stock-finder-watchlist-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      showAlert(
        ok ? "CSV Exported" : "Export Failed",
        ok ? "Your watchlist CSV has been created." : "Could not create the CSV file on this device.",
      );
    } catch (e) {
      // A storage read failure must not reject unhandled.
      console.error("[DataSection] CSV export failed", e);
      showAlert("Export Failed", "We couldn't export your watchlist. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    tapHaptic();
    setBusy(true);
    try {
      const contents = await pickBackupFile();
      if (!contents) return;
      const backup = parseBackup(contents);
      if (!backup) {
        showAlert(
          "Invalid Backup",
          "That file is not a valid Product Stock Finder backup.",
        );
        return;
      }
      const [watchlist, alerts, reminders, stockWatches, settings] =
        await Promise.all([
          getWatchlist(),
          getAlerts(),
          getBackOrderReminders(),
          getStockWatches(),
          getSettings(),
        ]);
      const result = applyBackup(backup, {
        watchlist,
        alerts,
        reminders,
        stockWatches,
        settings,
      });
      const summary = mergeSummary(result.counts);
      showAlert("Import Backup?", summary, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Import",
          onPress: async () => {
            setBusy(true);
            try {
              // Re-read and merge at save time: the snapshot above was taken
              // before this confirmation dialog, and a price check or a sync
              // pull can write the watchlist while the user decides — saving the
              // stale snapshot reverted those changes.
              const [
                freshWatchlist,
                freshAlerts,
                freshReminders,
                freshWatches,
                freshSettings,
              ] = await Promise.all([
                getWatchlist(),
                getAlerts(),
                getBackOrderReminders(),
                getStockWatches(),
                getSettings(),
              ]);
              const fresh = applyBackup(backup, {
                watchlist: freshWatchlist,
                alerts: freshAlerts,
                reminders: freshReminders,
                stockWatches: freshWatches,
                settings: freshSettings,
              });
              const now = Date.now();
              // Stamp each collection's sync meta immediately after its save, so
              // a later failure cannot leave imported data that never syncs.
              await saveWatchlist(fresh.watchlist);
              for (const id of fresh.touchedIds.watchlist)
                await setItemSyncMeta("watchlist", id, now);
              await saveAlerts(fresh.alerts);
              for (const id of fresh.touchedIds.alerts)
                await setItemSyncMeta("alerts", id, now);
              await saveBackOrderReminders(fresh.reminders);
              for (const id of fresh.touchedIds.reminders)
                await setItemSyncMeta("reminders", id, now);
              await saveStockWatches(fresh.stockWatches);
              // Stock watches share the reminders sync collection
              for (const id of fresh.touchedIds.stockWatches)
                await setItemSyncMeta("reminders", id, now);
              if (fresh.settingsApplied) await saveSettings(fresh.settings);
              showAlert("Backup Imported", mergeSummary(fresh.counts));
            } catch (e) {
              // A storage write failure must not reject unhandled.
              console.error("[DataSection] import save failed", e);
              showAlert("Import failed", "We couldn't save the imported backup. Please try again.");
            } finally {
              setBusy(false);
            }
          },
        },
      ]);
    } catch (e) {
      console.error("[DataSection] import failed", e);
      showAlert("Import failed", "We couldn't import that backup. Please check the file and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionHeader title="Data" />
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: 16,
          marginHorizontal: 16,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
        }}
      >
        <SettingRow
          icon="square.and.arrow.up"
          label="Export Backup"
          description="Save watchlist, alerts and settings to a file"
          right={
            <TouchableOpacity activeOpacity={0.85}
              onPress={handleExport}
              disabled={busy}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                backgroundColor: colors.primary + "22",
                opacity: busy ? 0.5 : 1,
              }}
              accessibilityLabel="Export backup"
              accessibilityRole="button"
            >
              <Text
                style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}
              >
                {busy ? "…" : "Export"}
              </Text>
            </TouchableOpacity>
          }
        />
        <SettingRow
          icon="square.and.arrow.down"
          label="Import Backup"
          description="Restore from a backup file (merges by id)"
          right={
            <TouchableOpacity activeOpacity={0.85}
              onPress={handleImport}
              disabled={busy}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                backgroundColor: colors.primary + "22",
                opacity: busy ? 0.5 : 1,
              }}
              accessibilityLabel="Import backup"
              accessibilityRole="button"
            >
              <Text
                style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}
              >
                Import
              </Text>
            </TouchableOpacity>
          }
        />
        <SettingRow
          icon="doc.on.doc"
          label="Export CSV"
          description="Save watchlist as CSV (prices in display currency)"
          right={
            <TouchableOpacity activeOpacity={0.85}
              onPress={handleExportCsv}
              disabled={busy}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                backgroundColor: colors.primary + "22",
                opacity: busy ? 0.5 : 1,
              }}
              accessibilityLabel="Export CSV"
              accessibilityRole="button"
            >
              <Text
                style={{ color: colors.primary, fontSize: 13, fontWeight: "600" }}
              >
                {busy ? "…" : "Export"}
              </Text>
            </TouchableOpacity>
          }
        />
      </View>
    </>
  );
}

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
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

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

async function exportCsvFile(csv: string): Promise<boolean> {
  try {
    const fileName = `product-stock-finder-watchlist-${new Date().toISOString().slice(0, 10)}.csv`;
    if (Platform.OS === "web") {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      return true;
    }
    const uri = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri, {
      mimeType: "text/csv",
      dialogTitle: "Export CSV",
    });
    return true;
  } catch {
    return false;
  }
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
      const ok = await exportCsvFile(csv);
      showAlert(
        ok ? "CSV Exported" : "Export Failed",
        ok ? "Your watchlist CSV has been created." : "Could not create the CSV file on this device.",
      );
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
              await saveWatchlist(result.watchlist);
              await saveAlerts(result.alerts);
              await saveBackOrderReminders(result.reminders);
              await saveStockWatches(result.stockWatches);
              if (result.settingsApplied) await saveSettings(result.settings);
              const now = Date.now();
              for (const id of result.touchedIds.watchlist)
                await setItemSyncMeta("watchlist", id, now);
              for (const id of result.touchedIds.alerts)
                await setItemSyncMeta("alerts", id, now);
              for (const id of result.touchedIds.reminders)
                await setItemSyncMeta("reminders", id, now);
              // Stock watches share the reminders sync collection
              for (const id of result.touchedIds.stockWatches)
                await setItemSyncMeta("reminders", id, now);
              showAlert("Backup Imported", summary);
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

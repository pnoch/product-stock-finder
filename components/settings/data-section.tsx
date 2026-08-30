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
            <TouchableOpacity
              onPress={handleExport}
              disabled={busy}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                backgroundColor: colors.primary + "22",
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
            <TouchableOpacity
              onPress={handleImport}
              disabled={busy}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                backgroundColor: colors.primary + "22",
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
      </View>
    </>
  );
}

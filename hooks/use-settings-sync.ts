import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { log } from "@shared/log";
import { getSyncMeta } from "@/lib/storage";
import { formatSyncStatus, getSyncSetup } from "@/lib/sync";
import type { SyncMeta } from "@/lib/types";

export function useSettingsSync(
  isAuthenticated: boolean,
  configured: boolean,
) {
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const refresh = async () => {
      const meta = await getSyncMeta().catch(() => null);
      if (!cancelled && meta) {
        setSyncMeta(meta);
        setNow(Date.now());
      }
    };
    void refresh();
    const interval = setInterval(refresh, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  const syncStatus = syncMeta
    ? formatSyncStatus(syncMeta, isAuthenticated, now)
    : isAuthenticated
      ? { label: "Not synced yet", tone: "muted" as const }
      : configured
        ? { label: "Sign in to sync across devices", tone: "muted" as const }
        : {
            label: "Local-only mode — prices are fetched on this device",
            tone: "muted" as const,
          };

  const handleSyncNow = useCallback(async () => {
    if (syncing || !getSyncSetup()) return;
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSyncing(true);
    try {
      await getSyncSetup()?.syncNow();
      const meta = await getSyncMeta();
      setSyncMeta(meta);
      setNow(Date.now());
    } catch (e) {
      log.error("[Settings] syncNow failed", e);
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  return { syncMeta, now, syncing, syncStatus, handleSyncNow };
}

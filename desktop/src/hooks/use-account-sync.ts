import { useCallback, useEffect, useState } from "react";
import { storage } from "../storage";
import { getApiBaseUrl } from "../lib/api-base";
import { getSyncSetup, formatSyncStatus, type SyncStatus } from "../../../lib/sync";
import type { SyncMeta } from "../../../lib/types";

export function useAccountSync({
  isAuthenticated,
  now,
}: {
  isAuthenticated: boolean;
  now: number;
}) {
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    queueMicrotask(() => {
      storage
        .getSyncMeta()
        .then((meta) => {
          if (!cancelled) setSyncMeta(meta);
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, now]);

  const syncStatus: SyncStatus = syncMeta
    ? formatSyncStatus(syncMeta, isAuthenticated, now)
    : isAuthenticated
      ? { label: "Not synced yet", tone: "muted" }
      : getApiBaseUrl()
        ? { label: "Sign in to sync across devices", tone: "muted" }
        : { label: "Local-only mode — prices are fetched on this device", tone: "muted" };

  const syncStatusClass =
    syncStatus.tone === "error"
      ? "text-red-600 dark:text-red-400"
      : syncStatus.tone === "success"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-gray-500 dark:text-gray-400";

  const handleSyncNow = useCallback(async () => {
    const setup = getSyncSetup();
    if (syncing || !setup) return;
    setSyncing(true);
    setSyncMessage(null);
    try {
      await setup.syncNow();
      const meta = await storage.getSyncMeta();
      setSyncMeta(meta);
      setSyncMessage("Synced just now");
    } catch {
      setSyncMessage("Sync failed");
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  return {
    syncStatus,
    syncStatusClass,
    syncing,
    syncMessage,
    handleSyncNow,
  };
}

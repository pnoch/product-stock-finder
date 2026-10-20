import type { Collection, SyncMeta } from "@/lib/types";

export interface SyncSetup {
  syncNow: () => Promise<void>;
  schedule: () => void;
}

export function countQueuedEdits(meta: SyncMeta): number {
  const cursor = meta.lastSyncedAt || 0;
  let count = 0;
  for (const col of Object.keys(meta.items) as Collection[]) {
    const colMap = meta.items[col] ?? {};
    for (const entry of Object.values(colMap)) {
      if (entry.updatedAt > cursor) count++;
    }
  }
  return count;
}

export interface SyncStatus {
  label: string;
  tone: "success" | "error" | "muted";
}

export function formatSyncStatus(
  meta: SyncMeta,
  isAuthenticated: boolean,
  now: number,
): SyncStatus {
  if (!isAuthenticated) {
    return { label: "Sign in to sync across devices", tone: "muted" };
  }
  if (meta.lastSyncError) {
    return { label: meta.lastSyncError, tone: "error" };
  }
  const successAt = meta.lastSyncOkAt ?? meta.lastSyncedAt;
  if (!successAt) {
    return { label: "Not synced yet", tone: "muted" };
  }
  const minutes = Math.floor((now - successAt) / 60000);
  const label =
    minutes < 1
      ? "Synced just now"
      : minutes < 60
        ? `Last synced ${minutes}m ago`
        : `Last synced ${Math.floor(minutes / 60)}h ago`;
  return { label, tone: minutes < 5 ? "success" : "muted" };
}

let syncSetupRef: SyncSetup | null = null;

export function registerSyncSetup(setup: SyncSetup | null): () => void {
  syncSetupRef = setup;
  return () => {
    if (syncSetupRef === setup) syncSetupRef = null;
  };
}

export function getSyncSetup(): SyncSetup | null {
  return syncSetupRef;
}

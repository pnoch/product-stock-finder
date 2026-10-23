import type { Storage } from "../storage";
import type { Collection, SyncItem } from "../types";
import { currentSyncGeneration } from "@/lib/sync-gate";
import { removeLocalItem } from "./apply";

type SyncMeta = Awaited<ReturnType<Storage["getSyncMeta"]>>;

// Full resync: the server's tombstone window has moved past our cursor, so
// locally-present items absent from the pull may shadow purged deletes. Drop
// those with stale sync meta. Items with no meta entry are genuine
// never-synced offline work and are preserved (and pushed by the caller).
// Known limitation: seeds and ancient never-synced items can resurrect rows
// deleted + purged elsewhere (tombstone expiry is inherent to the design); the
// user can delete them again. Settings is excluded: the client never emits
// settings tombstones, so there is nothing to resurrect.
export async function pruneMissingAfterFullResync({
  storage,
  meta,
  pulled,
  oldCursor,
  gate,
}: {
  storage: Storage;
  meta: SyncMeta;
  pulled: { fullResyncSince?: number | null; items: SyncItem[] };
  oldCursor: number;
  gate: number;
}): Promise<void> {
  if (pulled.fullResyncSince == null) return;
  if (currentSyncGeneration() !== gate) return;
  const cutoff = pulled.fullResyncSince;
  const pulledIds = new Set(pulled.items.map((i) => `${i.collection}:${i.id}`));
  const localLists: { collection: Collection; ids: string[] }[] = [
    {
      collection: "watchlist",
      ids: (await storage.getWatchlist()).map((p) => p.id),
    },
    {
      collection: "alerts",
      ids: (await storage.getAlerts()).map((a) => a.id),
    },
    {
      collection: "reminders",
      ids: [
        ...(await storage.getBackOrderReminders()).map((r) => r.id),
        ...(await storage.getStockWatches()).map((w) => w.id),
      ],
    },
  ];
  for (const { collection, ids } of localLists) {
    for (const id of ids) {
      if (currentSyncGeneration() !== gate) return;
      if (pulledIds.has(`${collection}:${id}`)) continue;
      const entry = meta.items[collection]?.[id];
      // `entry.updatedAt <= oldCursor` means the item was already confirmed at
      // or before the last successful sync; anything edited since is still
      // dirty (or was never pushed at all) and must be kept and pushed —
      // dropping it deleted genuinely local, never-synced work.
      if (entry && entry.updatedAt < cutoff && entry.updatedAt <= oldCursor) {
        await removeLocalItem(storage, collection, id);
        await storage.clearItemSyncMeta(collection, id);
        storage.notifyLocal(collection, id);
      }
    }
  }
}

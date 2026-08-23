import type { Collection, SyncMeta } from "../types";
import type { StorageContext } from "./context";

export function createSyncMetaStorage(ctx: StorageContext) {
  const { adapter, KEYS, enqueue } = ctx;

  // ─── Sync Meta ─────────────────────────────────────────────────────────────

  async function getSyncMeta(): Promise<SyncMeta> {
    try {
      const raw = await adapter.getItem(KEYS.SYNC_META);
      if (!raw) return { lastSyncedAt: 0, items: {} };
      const parsed = JSON.parse(raw);
      return {
        lastSyncedAt:
          typeof parsed.lastSyncedAt === "number" ? parsed.lastSyncedAt : 0,
        lastSyncOkAt:
          typeof parsed.lastSyncOkAt === "number"
            ? parsed.lastSyncOkAt
            : undefined,
        lastSyncError:
          typeof parsed.lastSyncError === "string" ||
          parsed.lastSyncError === null
            ? parsed.lastSyncError
            : undefined,
        items: parsed.items ?? {},
      };
    } catch {
      return { lastSyncedAt: 0, items: {} };
    }
  }

  // Persists sync meta via read-modify-write. `saveSyncMeta` merges `items`
  // into the existing meta (lastSyncedAt is taken from the argument). The
  // merge is per collection, not per item: callers must pass the full
  // contents of any collection they touch, since its entry replaces that
  // collection wholesale. NOT enqueued — internal helpers call it while
  // already inside enqueue(KEYS.SYNC_META, ...); the public `saveSyncMeta`
  // wrapper below adds the queue for external callers.
  async function persistSyncMeta(meta: SyncMeta): Promise<void> {
    const existing = await getSyncMeta();
    await adapter.setItem(
      KEYS.SYNC_META,
      JSON.stringify({
        lastSyncedAt: meta.lastSyncedAt,
        lastSyncOkAt: meta.lastSyncOkAt ?? existing.lastSyncOkAt,
        lastSyncError:
          meta.lastSyncError !== undefined
            ? meta.lastSyncError
            : existing.lastSyncError,
        items: { ...existing.items, ...meta.items },
      }),
    );
  }

  // Serialized on the sync-meta write queue so it cannot race other queued
  // meta mutations (setItemSyncMeta/markItemDeleted/clearItemSyncMeta).
  async function saveSyncMeta(meta: SyncMeta): Promise<void> {
    await enqueue(KEYS.SYNC_META, async () => {
      await persistSyncMeta(meta);
    });
  }

  function updateItemMeta(
    collection: Collection,
    id: string,
    patch: { updatedAt: number; deleted: boolean },
  ): Promise<void> {
    return enqueue(KEYS.SYNC_META, async () => {
      const meta = await getSyncMeta();
      const col = meta.items[collection] ?? {};
      col[id] = patch;
      meta.items[collection] = col;
      await persistSyncMeta(meta);
    });
  }

  async function setItemSyncMeta(
    collection: Collection,
    id: string,
    updatedAt: number,
  ): Promise<void> {
    await updateItemMeta(collection, id, { updatedAt, deleted: false });
  }

  async function markItemDeleted(
    collection: Collection,
    id: string,
    updatedAt: number,
  ): Promise<void> {
    await updateItemMeta(collection, id, { updatedAt, deleted: true });
  }

  async function clearItemSyncMeta(
    collection: Collection,
    id: string,
  ): Promise<void> {
    await enqueue(KEYS.SYNC_META, async () => {
      const meta = await getSyncMeta();
      const col = meta.items[collection];
      if (col && col[id]) {
        delete col[id];
        await persistSyncMeta(meta);
      }
    });
  }

  return {
    getSyncMeta,
    saveSyncMeta,
    setItemSyncMeta,
    markItemDeleted,
    clearItemSyncMeta,
  };
}

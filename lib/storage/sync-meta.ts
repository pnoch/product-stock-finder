import type { Collection, SyncMeta } from "../types";
import type { StorageContext } from "./context";
import { quarantinePayload } from "./context";

export function createSyncMetaStorage(ctx: StorageContext) {
  const { adapter, KEYS, enqueue } = ctx;

  // ─── Sync Meta ─────────────────────────────────────────────────────────────

  async function getSyncMeta(): Promise<SyncMeta> {
    let raw: string | null;
    try {
      raw = await adapter.getItem(KEYS.SYNC_META);
    } catch (error) {
      console.warn("[storage] read failed for sync_meta", error);
      throw error;
    }
    if (!raw) return { lastSyncedAt: 0, items: {} };
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("sync meta payload must be an object");
      }
      const meta = parsed as Partial<SyncMeta> & { items?: unknown };
      if (meta.items !== undefined && (typeof meta.items !== "object" || meta.items === null || Array.isArray(meta.items))) {
        throw new Error("sync meta items must be an object");
      }
      return {
        lastSyncedAt:
          typeof meta.lastSyncedAt === "number" ? meta.lastSyncedAt : 0,
        lastSyncOkAt:
          typeof meta.lastSyncOkAt === "number"
            ? meta.lastSyncOkAt
            : undefined,
        lastSyncError:
          typeof meta.lastSyncError === "string" ||
          meta.lastSyncError === null
            ? meta.lastSyncError
            : undefined,
        items: (meta.items ?? {}) as SyncMeta["items"],
        retryKeys: Array.isArray(meta.retryKeys)
          ? meta.retryKeys.filter((k): k is string => typeof k === "string")
          : undefined,
      };
    } catch {
      await quarantinePayload(adapter, KEYS.SYNC_META, raw);
      console.warn("[storage] quarantined corrupt payload for sync_meta");
      return { lastSyncedAt: 0, items: {} };
    }
  }

  // Persists sync meta via read-modify-write. `items` merges per item
  // within each collection (never wholesale-replaces a collection), and
  // `lastSyncedAt` only moves forward. NOT enqueued — internal helpers call
  // it while already inside enqueue(KEYS.SYNC_META, ...); the public
  // `saveSyncMeta` wrapper below adds the queue for external callers.
  async function persistSyncMeta(meta: SyncMeta): Promise<void> {
    const existing = await getSyncMeta();
    const merged: SyncMeta["items"] = { ...existing.items };
    for (const [collection, entries] of Object.entries(meta.items)) {
      merged[collection as keyof SyncMeta["items"]] = {
        ...(existing.items[collection as keyof SyncMeta["items"]] ?? {}),
        ...entries,
      } as never;
    }
    await adapter.setItem(
      KEYS.SYNC_META,
      JSON.stringify({
        lastSyncedAt: Math.max(existing.lastSyncedAt, meta.lastSyncedAt),
        lastSyncOkAt: meta.lastSyncOkAt ?? existing.lastSyncOkAt,
        lastSyncError:
          meta.lastSyncError !== undefined
            ? meta.lastSyncError
            : existing.lastSyncError,
        items: merged,
        retryKeys:
          meta.retryKeys !== undefined ? meta.retryKeys : existing.retryKeys,
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
        // Write through directly instead of persistSyncMeta: the merge in
        // persistSyncMeta would resurrect this entry from the stored copy.
        await adapter.setItem(KEYS.SYNC_META, JSON.stringify(meta));
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

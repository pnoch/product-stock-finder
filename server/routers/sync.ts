import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { SYNC_PULL_MAX_ITEMS, SYNC_PUSH_MAX_ITEMS } from "../../shared/const.js";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { mapWithConcurrency } from "../concurrency";
import { checkRateLimit } from "../rate-limit";
import {
  listChangedItems,
  purgeOldTombstones,
  SYNC_COLLECTION_ORDER,
  TOMBSTONE_PURGE_WINDOW_MS,
  upsertSyncItem,
} from "../sync-db";
import type { SyncRejectedItem, SyncStampedItem } from "../../lib/types";

let lastTombstonePurgeAt = 0;
const TOMBSTONE_PURGE_INTERVAL_MS = 60 * 60 * 1000;

const syncItemSchema = z.object({
  collection: z.enum(["watchlist", "alerts", "reminders", "settings"]),
  id: z.string().min(1).max(191),
  data: z.unknown().refine(
    (v) => {
      try {
        return JSON.stringify(v ?? null).length < 100_000;
      } catch {
        return false;
      }
    },
    { message: "data too large" },
  ),
  updatedAt: z.number().finite().nonnegative(),
  deletedAt: z.number().finite().nonnegative().nullable(),
});

export const syncRouter = router({
  pull: protectedProcedure
    .input(
      z.object({
        since: z.number().finite().nonnegative().nullable(),
        // Composite page cursor (stamp + collection + id) from the previous
        // page. A stamp alone cannot page correctly when rows share a stamp.
        cursor: z
          .object({
            stamp: z.number().finite().nonnegative(),
            collection: z.string().min(1).max(32),
            id: z.string().min(1).max(191),
          })
          .nullable()
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      checkRateLimit(ctx, "sync.pull", 60, 60_000);
      const db = await getDb();
      if (!db) {
        console.warn("[Sync] Database not available; returning empty pull");
        return { lastSyncedAt: input.since ?? 0, items: [], fullResyncSince: null as number | null };
      }
      // Capture the cursor before the SELECT so writes committed during
      // the query are not missed on the next pull.
      const lastSyncedAt = Date.now();
      // Tombstones older than the retention window are purged, so a client
      // whose cursor predates the window cannot distinguish "deleted long
      // ago" from "unchanged since before the cursor" using an incremental
      // pull. On a full resync, return the *complete* current state (plus
      // recent tombstones) so the client can safely drop anything absent —
      // an incremental pull would omit untouched live rows and the client
      // would delete them.
      const cutoff = lastSyncedAt - TOMBSTONE_PURGE_WINDOW_MS;
      const needsFullResync = input.since != null && input.since < cutoff;
      // Page the result: a full resync returns every live row plus
      // tombstones, so an unbounded payload could be very large. `hasMore`
      // tells the client to re-pull with the returned cursor.
      // On a continuation page, re-include rows at the cursor (inclusive) so
      // a boundary cannot skip an item; the client dedupes by key.
      const pageSince = needsFullResync ? null : input.since;
      const items = await listChangedItems(
        ctx.user.id,
        pageSince,
        SYNC_PULL_MAX_ITEMS + 1,
        input.cursor ?? null,
      );
      // The four per-collection queries are each ordered, but the merged
      // list is not: sort globally by the same (stamp, collection, id) key
      // the cursor uses, then take a prefix.
      // Must match SYNC_COLLECTION_ORDER in server/sync-db.ts.
      const COLLECTION_ORDER = SYNC_COLLECTION_ORDER;
      const stampOf = (i: (typeof items)[number]) =>
        Math.max(i.updatedAt, i.deletedAt ?? 0);
      const sorted = [...items].sort((a, b) => {
        const sa = stampOf(a);
        const sb = stampOf(b);
        if (sa !== sb) return sa - sb;
        const ca = COLLECTION_ORDER.indexOf(a.collection);
        const cb = COLLECTION_ORDER.indexOf(b.collection);
        if (ca !== cb) return ca - cb;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
      const hasMore = sorted.length > SYNC_PULL_MAX_ITEMS;
      const page = hasMore ? sorted.slice(0, SYNC_PULL_MAX_ITEMS) : sorted;
      // The cursor is the last item of the page in the deterministic
      // (stamp, collection, id) order the query uses.
      const last = page[page.length - 1];
      const nextCursor =
        hasMore && last
          ? {
              stamp: Math.max(last.updatedAt, last.deletedAt ?? 0),
              collection: last.collection,
              id: last.id,
            }
          : null;
      const fullResyncSince = needsFullResync ? cutoff : null;
      return { lastSyncedAt, items: page, fullResyncSince, hasMore, nextCursor };
    }),
  push: protectedProcedure
    .input(z.object({ items: z.array(syncItemSchema).max(SYNC_PUSH_MAX_ITEMS) }))
    .mutation(async ({ ctx, input }) => {
      checkRateLimit(ctx, "sync.push", 30, 60_000);
      // Total-payload cap: 200 items × 100KB per item would let one push
      // force ~20MB of upserts. Real clients send a handful of small rows.
      let totalBytes = 0;
      try {
        for (const item of input.items) {
          totalBytes += JSON.stringify(item.data ?? null).length;
        }
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unserializable sync data",
        });
      }
      if (totalBytes > 5_000_000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Sync payload too large",
        });
      }
      // Future-dated stamps win LWW forever, so a client with a bad clock
      // must not be able to poison conflict resolution. Clamp rather than
      // reject the whole batch: rejecting wedged sync permanently (the
      // client re-sends the same future stamp every retry), whereas clamping
      // lets the server stamp win and the client self-heal.
      const maxStamp = Date.now() + 5 * 60_000;
      const nowMs = Date.now();
      const items = input.items.map((item) => {
        const updatedAt =
          item.updatedAt > maxStamp ? nowMs : item.updatedAt;
        const deletedAt =
          item.deletedAt !== null && item.deletedAt > maxStamp
            ? nowMs
            : item.deletedAt;
        return updatedAt === item.updatedAt && deletedAt === item.deletedAt
          ? item
          : { ...item, updatedAt, deletedAt };
      });
      const db = await getDb();
      if (!db) {
        console.warn("[Sync] Database not available; accepting nothing");
        return { accepted: 0, stamped: [], rejected: [] as SyncRejectedItem[] };
      }
      // Bounded concurrency: each item is an INSERT + a SELECT, so a
      // 200-item push was 400 serialized round trips holding the response
      // open. Order is preserved so the stamped/rejected arrays stay stable.
      const results = await mapWithConcurrency(items, 8, (item) =>
        upsertSyncItem(ctx.user.id, item),
      );
      const stamped: SyncStampedItem[] = [];
      const rejected: SyncRejectedItem[] = [];
      let accepted = 0;
      items.forEach((item, i) => {
        const result = results[i]!;
        if (result.accepted) {
          accepted += 1;
          stamped.push({
            collection: item.collection,
            id: item.id,
            updatedAt: result.updatedAt,
          });
        } else {
          rejected.push({
            collection: item.collection,
            id: item.id,
            reason: result.reason ?? "stale_write",
          });
        }
      });
      const now = Date.now();
      if (now - lastTombstonePurgeAt > TOMBSTONE_PURGE_INTERVAL_MS) {
        lastTombstonePurgeAt = now;
        await purgeOldTombstones(now - TOMBSTONE_PURGE_WINDOW_MS);
      }
      return { accepted, stamped, rejected };
    }),
});

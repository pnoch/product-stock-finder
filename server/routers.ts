import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  COOKIE_NAME,
  MAX_UPLOAD_ALERTS,
  MAX_UPLOAD_DATE_REMINDERS,
  MAX_UPLOAD_HEALTH_EVENTS,
  MAX_UPLOAD_HISTORY_POINTS,
  MAX_UPLOAD_STOCK_WATCHES,
  SYNC_PUSH_MAX_ITEMS,
} from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import {
  listChangedItems,
  purgeOldTombstones,
  TOMBSTONE_PURGE_WINDOW_MS,
  upsertSyncItem,
} from "./sync-db";
import { sharedWatchlists, sharedWatchlistMembers, watchlistItems } from "../drizzle/schema";

const LOCAL_ORIGIN_FALLBACK = "http://localhost:8081";

function cleanHttpUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/\/$/, "");
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

// Share URLs must never be built from attacker-controlled Origin/Referer
// headers (phishing via a poisoned link host). Only deployment config is
// trusted; otherwise fall back to localhost.
export function getOrigin(req?: { headers: Record<string, unknown> }): string {
  void req;
  const envWeb = cleanHttpUrl(process.env.EXPO_PUBLIC_WEB_URL);
  if (envWeb) return envWeb;
  const envApi = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envApi) {
    try {
      const u = new URL(envApi.trim());
      if (u.protocol === "http:" || u.protocol === "https:") {
        if (u.port === "3000") u.port = "8081";
        return `${u.protocol}//${u.host}`;
      }
    } catch {
      // fall through to localhost
    }
  }
  return LOCAL_ORIGIN_FALLBACK;
}

let lastTombstonePurgeAt = 0;
const TOMBSTONE_PURGE_INTERVAL_MS = 60 * 60 * 1000;

// Public share links return the owner's watchlist; cap the payload so a very
// large watchlist can't turn the endpoint into an expensive unbounded read.
const SHARED_WATCHLIST_MAX_ITEMS = 500;
import { getPrice } from "./prices";
import { checkAllDistributors } from "./health";

// Short server cache: one health.check fans out to ~25 distributor scrapes,
// so repeat calls within the window reuse the previous result instead of
// re-scraping (rate limiting alone still allows 125 scrapes/min/IP).
const HEALTH_CACHE_TTL_MS = 5 * 60 * 1000;
let healthCache: {
  at: number;
  result: Awaited<ReturnType<typeof checkAllDistributors>> | null;
} = {
  at: 0,
  result: null,
};

export function clearHealthCacheForTests(): void {
  healthCache = { at: 0, result: null };
}
import { getFxRates } from "./fx";
import { mergeHistory } from "./price-history";
import { checkRateLimit, checkRateLimitByKey } from "./rate-limit";
import { getInsight } from "./price-insights";
import { getProductImage } from "./product-images";
import { discoveryRouter } from "./routers/discovery";
import { trendingRouter } from "./routers/trending";
import { parseProductText } from "./product-parse";
import type { SyncRejectedItem, SyncStampedItem } from "../lib/types";
import { upsertDeviceConfig, pullPendingEvents } from "./notifications";
import { upsertPushToken, pruneDeviceToken } from "./push-notifications";
import {
  listDevicesForUser,
  getDeviceBinding,
  assertDeviceAccess,
  renameDevice,
  signOutDevice,
  cleanupStaleDevices,
  STALE_DEVICE_MS,
} from "./devices";

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

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
      checkRateLimit(ctx, "auth.deleteAccount", 5, 60_000);
      const { deleteUserById } = await import("./db.js");
      await deleteUserById(ctx.user.id);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  sync: router({
    pull: protectedProcedure
      .input(z.object({ since: z.number().finite().nonnegative().nullable() }))
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
        const items = await listChangedItems(
          ctx.user.id,
          needsFullResync ? null : input.since,
        );
        const fullResyncSince = needsFullResync ? cutoff : null;
        return { lastSyncedAt, items, fullResyncSince };
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
        const stamped: SyncStampedItem[] = [];
        const rejected: SyncRejectedItem[] = [];
        let accepted = 0;
        for (const item of items) {
          const result = await upsertSyncItem(ctx.user.id, item);
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
        }
        const now = Date.now();
        if (now - lastTombstonePurgeAt > TOMBSTONE_PURGE_INTERVAL_MS) {
          lastTombstonePurgeAt = now;
          await purgeOldTombstones(now - TOMBSTONE_PURGE_WINDOW_MS);
        }
        return { accepted, stamped, rejected };
      }),
  }),

  prices: router({
    get: publicProcedure
      .input(
        z.object({
          distributorId: z.string().min(1).max(64),
          modelNumber: z.string().min(1).max(128),
        }),
      )
      .query(async ({ ctx, input }) => {
        checkRateLimit(ctx, "prices.get", 60, 60_000);
        return getPrice(input.distributorId, input.modelNumber);
      }),
    uploadHistory: protectedProcedure
      .input(
        z.object({
          distributorId: z.string().min(1).max(64),
          modelNumber: z.string().min(1).max(128),
          points: z
            .array(
              z.object({
                // Must be a strict ISO-8601 UTC instant: the column is a
                // varchar(10) day key compared lexicographically, and a
                // future-dated point would win every LWW merge forever
                // (purgeOldHistory only removes past rows).
                date: z
                  .string()
                  .regex(
                    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/,
                    "date must be an ISO-8601 UTC timestamp",
                  )
                  .refine(
                    (v) => {
                      const t = Date.parse(v);
                      return !Number.isNaN(t) && t <= Date.now() + 86_400_000;
                    },
                    "date must not be in the future",
                  ),
                price: z.number().finite().positive(),
                currency: z.string().min(1).max(8),
                stockStatus: z.enum([
                  "in_stock",
                  "back_order",
                  "out_of_stock",
                  "unknown",
                ]),
              }),
            )
            .max(MAX_UPLOAD_HISTORY_POINTS),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(ctx, "prices.uploadHistory", 30, 60_000);
        // History is global per distributor/model; writes are protected to
        // prevent anonymous pollution. No per-user ownership check needed.
        void ctx.user.id;
        await mergeHistory(
          input.distributorId,
          input.modelNumber,
          input.points,
        );
        return { accepted: input.points.length } as const;
      }),
  }),

  health: router({
    check: publicProcedure.query(async ({ ctx }) => {
      checkRateLimit(ctx, "health.check", 5, 60_000);
      const now = Date.now();
      if (
        healthCache.result !== null &&
        now - healthCache.at < HEALTH_CACHE_TTL_MS
      ) {
        return healthCache.result;
      }
      const result = await checkAllDistributors();
      healthCache = { at: now, result };
      return result;
    }),
  }),

  fx: router({
    get: publicProcedure.query(async ({ ctx }) => {
      checkRateLimit(ctx, "fx.get", 60, 60_000);
      return getFxRates();
    }),
  }),

  insights: router({
    get: publicProcedure
      .input(z.object({ productId: z.string().min(1).max(191) }))
      .query(async ({ ctx, input }) => {
        checkRateLimit(ctx, "insights.get", 30, 60_000);
        return getInsight(input.productId);
      }),
  }),

  images: router({
    get: publicProcedure
      .input(z.object({ productId: z.string().min(1).max(191) }))
      .query(async ({ ctx, input }) => {
        checkRateLimit(ctx, "images.get", 30, 60_000);
        return getProductImage(input.productId);
      }),
  }),

  products: router({
    parse: publicProcedure
      .input(z.object({ raw: z.string().min(1).max(2000) }))
      .query(async ({ ctx, input }) => {
        checkRateLimit(ctx, "products.parse", 10, 60_000);
        return { product: await parseProductText(input.raw) };
      }),
  }),

  notifications: router({
    uploadConfig: protectedProcedure
      .input(
        z.object({
          // Bounded: these arrays are persisted verbatim as JSON columns, so an
          // unbounded upload would let one device store an arbitrarily large
          // config (and the warmer would iterate it every tick).
          alerts: z
            .array(
              z.object({
                id: z.string().min(1).max(191),
                productId: z.string().min(1).max(191),
                targetPrice: z.number().finite().positive(),
                currency: z.string().min(1).max(8),
                distributorId: z.string().max(64).optional(),
                direction: z.enum(["drop", "rise"]).optional(),
                snoozedUntil: z.string().optional(),
              }),
            )
            .max(MAX_UPLOAD_ALERTS),
          stockWatches: z
            .array(
              z.object({
                id: z.string().min(1).max(191),
                productId: z.string().min(1).max(191),
                distributorId: z.string().min(1).max(64),
                lastKnownStatus: z.string().max(32).optional(),
              }),
            )
            .max(MAX_UPLOAD_STOCK_WATCHES),
          dateReminders: z
            .array(
              z.object({
                id: z.string().min(1).max(191),
                productId: z.string().min(1).max(191),
                distributorId: z.string().min(1).max(64),
                reminderDate: z.string().min(1).max(64),
              }),
            )
            .max(MAX_UPLOAD_DATE_REMINDERS),
          healthEvents: z
            .array(
              z.object({
                id: z.string().min(1).max(191),
                distributorId: z.string().min(1).max(64),
                distributorName: z.string().min(1).max(128),
                status: z.enum(["blocked", "error"]),
                title: z.string().min(1).max(255),
                body: z.string().min(1).max(1000),
                createdAt: z.number(),
              }),
            )
            .max(MAX_UPLOAD_HEALTH_EVENTS)
            .optional(),
          quietHours: z
            .object({
              start: z.string().regex(/^\d{2}:\d{2}$/),
              end: z.string().regex(/^\d{2}:\d{2}$/),
              // Minutes to add to local time to get UTC (Date.getTimezoneOffset).
              // Lets the server evaluate quiet hours in the user's timezone.
              utcOffsetMinutes: z.number().int().min(-840).max(840).optional(),
            })
            .optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        checkRateLimit(ctx, "notifications.uploadConfig", 30, 60_000);
        if (!ctx.deviceId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Missing device id",
          });
        }
        await assertDeviceAccess(ctx.user.id, ctx.deviceId);
        await upsertDeviceConfig(
          ctx.deviceId,
          {
            alerts: input.alerts,
            stockWatches: input.stockWatches,
            dateReminders: input.dateReminders,
            healthEvents: input.healthEvents,
            quietHours: input.quietHours,
          },
          ctx.user.id,
        );
        return { accepted: true } as const;
      }),
    pull: protectedProcedure.input(z.object({})).query(async ({ ctx }) => {
      checkRateLimit(ctx, "notifications.pull", 60, 60_000);
      if (!ctx.deviceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Missing device id",
        });
      }
      await assertDeviceAccess(ctx.user.id, ctx.deviceId);
      const events = await pullPendingEvents(ctx.deviceId, ctx.user.id);
      return { events };
    }),
    registerPushToken: protectedProcedure
      .input(
        z.object({
          token: z.string().min(1).max(2048),
          platform: z.enum(["ios", "android", "web"]),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        checkRateLimit(ctx, "notifications.registerPushToken", 10, 60_000);
        if (!ctx.deviceId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Missing device id",
          });
        }
        await assertDeviceAccess(ctx.user.id, ctx.deviceId);
        await upsertPushToken(ctx.deviceId, input.token, input.platform, ctx.user.id);
        return { accepted: true } as const;
      }),
    unregisterPushToken: protectedProcedure.mutation(async ({ ctx }) => {
      checkRateLimit(ctx, "notifications.unregisterPushToken", 10, 60_000);
      if (!ctx.deviceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Missing device id",
        });
      }
      await assertDeviceAccess(ctx.user.id, ctx.deviceId);
      await pruneDeviceToken(ctx.deviceId);
      return { accepted: true } as const;
    }),
  }),

  discovery: discoveryRouter,

  trending: trendingRouter,

  devices: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      checkRateLimit(ctx, "devices.list", 30, 60_000);
      const devices = await listDevicesForUser(ctx.user.id);
      return { devices };
    }),
    current: protectedProcedure
      .input(z.object({ deviceId: z.string().min(1).max(128) }))
      .query(async ({ ctx, input }) => {
        checkRateLimit(ctx, "devices.current", 30, 60_000);
        const { userId } = await getDeviceBinding(input.deviceId);
        // Only reveal binding to its owner; enumeration without auth is denied
        // by protectedProcedure, and cross-user checks avoid leaking existence.
        if (userId !== null && userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        return { deviceId: input.deviceId, userId };
      }),
    rename: protectedProcedure
      .input(
        z.object({
          deviceId: z.string().min(1).max(128),
          label: z.string().min(1).max(64),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(ctx, "devices.rename", 10, 60_000);
        const renamed = await renameDevice(
          ctx.user.id,
          input.deviceId,
          input.label,
        );
        return { renamed };
      }),
    signOut: protectedProcedure
      .input(z.object({ deviceId: z.string().min(1).max(128) }))
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(ctx, "devices.signOut", 10, 60_000);
        const signedOut = await signOutDevice(ctx.user.id, input.deviceId);
        return { signedOut };
      }),
    cleanupStale: protectedProcedure.mutation(async ({ ctx }) => {
      checkRateLimit(ctx, "devices.cleanupStale", 10, 60_000);
      const removed = await cleanupStaleDevices(
        ctx.user.id,
        Date.now() - STALE_DEVICE_MS,
        ctx.deviceId,
      );
      return { removed };
    }),
  }),

  sharedWatchlists: router({
    create: protectedProcedure
      .input(z.object({ title: z.string().min(1).max(255).optional() }))
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(ctx, "sharedWatchlists.create", 10, 60_000);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        let token = randomUUID();
        let inserted = false;
        for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
          try {
            await db.insert(sharedWatchlists).values({
              ownerId: ctx.user.id,
              token,
              title: input.title ?? "My Watchlist",
              expiresAt,
            });
            inserted = true;
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            const isDup = msg.includes("Duplicate entry") || msg.includes("UNIQUE") || msg.includes("unique");
            if (isDup && attempt < 2) { token = randomUUID(); continue; }
            throw e;
          }
        }
        const origin = getOrigin(ctx.req as unknown as { headers: Record<string, unknown> });
        return { token, shareUrl: `${origin}/w/${token}`, expiresAt: expiresAt.toISOString() } as const;
      }),
    get: publicProcedure
      .input(z.object({ token: z.string().min(1).max(64) }))
      .query(async ({ ctx, input }) => {
        // Public share links: bound both the caller (IP) and the token itself,
        // so a leaked token cannot be scraped at unbounded rate from rotating IPs.
        checkRateLimit(ctx, "sharedWatchlists.get", 60, 60_000);
        checkRateLimitByKey(
          `sharedWatchlists.get:token:${input.token}`,
          120,
          60_000,
        );
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const rows = await db
          .select()
          .from(sharedWatchlists)
          .where(eq(sharedWatchlists.token, input.token))
          .limit(1);
        const row = rows[0] as unknown as { ownerId: number; token: string; title: string; createdAt: Date; expiresAt: Date | null; updatedAt?: Date } | undefined;
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
        if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
          await db.delete(sharedWatchlists).where(eq(sharedWatchlists.token, input.token));
          throw new TRPCError({ code: "NOT_FOUND", message: "Share expired" });
        }
        // Cap the shared payload: a public endpoint must not return an
        // arbitrarily large watchlist (or read every row into memory) just
        // because the owner has thousands of items.
        const items = await db
          .select()
          .from(watchlistItems)
          .where(eq(watchlistItems.userId, row.ownerId))
          .limit(SHARED_WATCHLIST_MAX_ITEMS);
        const products = items
          .filter((r) => r.deletedAtMs === null || r.deletedAtMs === undefined)
          .map((r) => r.data)
          .filter(Boolean);
        return { title: row.title, token: row.token, products, truncated: items.length >= SHARED_WATCHLIST_MAX_ITEMS, createdAt: row.createdAt?.toISOString?.() ?? null, expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null } as const;
      }),
    revoke: protectedProcedure
      .input(z.object({ token: z.string().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(ctx, "sharedWatchlists.revoke", 10, 60_000);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        await db
          .delete(sharedWatchlists)
          .where(and(eq(sharedWatchlists.token, input.token), eq(sharedWatchlists.ownerId, ctx.user.id)));
        return { revoked: true } as const;
      }),
    list: protectedProcedure.query(async ({ ctx }) => {
      checkRateLimit(ctx, "sharedWatchlists.list", 30, 60_000);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const rows = await db
        .select()
        .from(sharedWatchlists)
        .where(eq(sharedWatchlists.ownerId, ctx.user.id))
        .orderBy(desc(sharedWatchlists.createdAt));
      const origin = getOrigin(ctx.req as unknown as { headers: Record<string, unknown> });
      return {
        links: (rows as unknown as { token: string; title: string; createdAt: Date | null; expiresAt: Date | null }[]).map((r) => ({
          token: r.token,
          title: r.title,
          shareUrl: `${origin}/w/${r.token}`,
          createdAt: r.createdAt?.toISOString?.() ?? null,
          expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
        })),
      } as const;
    }),
    extend: protectedProcedure
      .input(z.object({ token: z.string().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(ctx, "sharedWatchlists.extend", 10, 60_000);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const rows = await db.select().from(sharedWatchlists).where(eq(sharedWatchlists.token, input.token)).limit(1);
        const row = rows[0] as unknown as { ownerId: number } | undefined;
        if (!row || row.ownerId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await db
          .update(sharedWatchlists)
          .set({ expiresAt })
          .where(and(eq(sharedWatchlists.token, input.token), eq(sharedWatchlists.ownerId, ctx.user.id)));
        return { expiresAt: expiresAt.toISOString() } as const;
      }),
    invite: protectedProcedure
      .input(z.object({ token: z.string().min(1).max(64), userId: z.number().int().positive(), role: z.enum(["viewer", "editor"]).default("viewer") }))
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(ctx, "sharedWatchlists.invite", 20, 60_000);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const rows = await db.select().from(sharedWatchlists).where(eq(sharedWatchlists.token, input.token)).limit(1);
        const row = rows[0] as unknown as { ownerId: number } | undefined;
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
        if (row.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only owner can invite" });
        await db.insert(sharedWatchlistMembers).values({ token: input.token, userId: input.userId, role: input.role }).onDuplicateKeyUpdate({ set: { role: input.role } });
        return { invited: true } as const;
      }),
    members: protectedProcedure
      .input(z.object({ token: z.string().min(1).max(64) }))
      .query(async ({ ctx, input }) => {
        checkRateLimit(ctx, "sharedWatchlists.members", 30, 60_000);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const rows = await db.select().from(sharedWatchlists).where(eq(sharedWatchlists.token, input.token)).limit(1);
        const row = rows[0] as unknown as { ownerId: number } | undefined;
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
        const isOwner = row.ownerId === ctx.user.id;
        const memberRows = await db.select().from(sharedWatchlistMembers).where(eq(sharedWatchlistMembers.token, input.token));
        const isMember = memberRows.some((m) => m.userId === ctx.user.id);
        if (!isOwner && !isMember) throw new TRPCError({ code: "FORBIDDEN", message: "Not a member" });
        return { members: memberRows } as const;
      }),
    join: protectedProcedure
      .input(z.object({ token: z.string().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(ctx, "sharedWatchlists.join", 20, 60_000);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const rows = await db.select().from(sharedWatchlists).where(eq(sharedWatchlists.token, input.token)).limit(1);
        if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
        await db.insert(sharedWatchlistMembers).values({ token: input.token, userId: ctx.user.id, role: "viewer" }).onDuplicateKeyUpdate({ set: { role: "viewer" } });
        return { joined: true } as const;
      }),
    leave: protectedProcedure
      .input(z.object({ token: z.string().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(ctx, "sharedWatchlists.leave", 20, 60_000);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        await db.delete(sharedWatchlistMembers).where(and(eq(sharedWatchlistMembers.token, input.token), eq(sharedWatchlistMembers.userId, ctx.user.id)));
        return { left: true } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { COOKIE_NAME } from "../shared/const.js";
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

function getOrigin(req?: { headers: Record<string, unknown> }): string {
  const envWeb = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, "");
  if (envWeb) return envWeb;
  const envApi = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  if (envApi) {
    try {
      const u = new URL(envApi);
      if (u.port === "3000") u.port = "8081";
      return `${u.protocol}//${u.host}`;
    } catch {
      return envApi;
    }
  }
  const h = req?.headers as Record<string, string | undefined> | undefined;
  const origin = h?.origin ?? h?.referer;
  if (origin) {
    try {
      const u = new URL(origin);
      return `${u.protocol}//${u.host}`;
    } catch {
      return origin.replace(/\/$/, "");
    }
  }
  return "http://localhost:8081";
}

let lastTombstonePurgeAt = 0;
const TOMBSTONE_PURGE_INTERVAL_MS = 60 * 60 * 1000;
import { getPrice } from "./prices";
import { getFxRates } from "./fx";
import { mergeHistory } from "./price-history";
import { checkRateLimit } from "./rate-limit";
import { getInsight } from "./price-insights";
import { getProductImage } from "./product-images";
import { discoveryRouter } from "./routers/discovery";
import { trendingRouter } from "./routers/trending";
import { parseProductText } from "./product-parse";
import type { SyncStampedItem } from "../lib/types";
import { upsertDeviceConfig, pullPendingEvents } from "./notifications";
import { upsertPushToken } from "./push-notifications";
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
  updatedAt: z.number().finite(),
  deletedAt: z.number().finite().nullable(),
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
        const items = await listChangedItems(ctx.user.id, input.since);
        // Tombstones older than the retention window are purged, so a client
        // whose cursor predates the window cannot distinguish "deleted long
        // ago" from "never existed". Signal a full resync so it drops stale
        // local items instead of resurrecting them via push.
        const cutoff = lastSyncedAt - TOMBSTONE_PURGE_WINDOW_MS;
        const fullResyncSince =
          input.since != null && input.since < cutoff ? cutoff : null;
        return { lastSyncedAt, items, fullResyncSince };
      }),
    push: protectedProcedure
      .input(z.object({ items: z.array(syncItemSchema).max(500) }))
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(ctx, "sync.push", 30, 60_000);
        const db = await getDb();
        if (!db) {
          console.warn("[Sync] Database not available; accepting nothing");
          return { accepted: 0, stamped: [] };
        }
        const stamped: SyncStampedItem[] = [];
        let accepted = 0;
        for (const item of input.items) {
          const result = await upsertSyncItem(ctx.user.id, item);
          if (result.accepted) {
            accepted += 1;
            stamped.push({
              collection: item.collection,
              id: item.id,
              updatedAt: result.updatedAt,
            });
          }
        }
        const now = Date.now();
        if (now - lastTombstonePurgeAt > TOMBSTONE_PURGE_INTERVAL_MS) {
          lastTombstonePurgeAt = now;
          await purgeOldTombstones(
            ctx.user.id,
            now - TOMBSTONE_PURGE_WINDOW_MS,
          );
        }
        return { accepted, stamped };
      }),
  }),

  prices: router({
    get: publicProcedure
      .input(
        z.object({
          distributorId: z.string().min(1),
          modelNumber: z.string().min(1),
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
                date: z.string().refine((v) => !Number.isNaN(Date.parse(v))),
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
            .max(200),
        }),
      )
      .mutation(async ({ ctx, input }) => {
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

  fx: router({
    get: publicProcedure.query(async ({ ctx }) => {
      checkRateLimit(ctx, "fx.get", 60, 60_000);
      return getFxRates();
    }),
  }),

  insights: router({
    get: publicProcedure
      .input(z.object({ productId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        checkRateLimit(ctx, "insights.get", 30, 60_000);
        return getInsight(input.productId);
      }),
  }),

  images: router({
    get: publicProcedure
      .input(z.object({ productId: z.string().min(1) }))
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
          alerts: z.array(
            z.object({
              id: z.string().min(1).max(191),
              productId: z.string().min(1).max(191),
              targetPrice: z.number().finite().positive(),
              currency: z.string().min(1).max(8),
              distributorId: z.string().max(64).optional(),
              direction: z.enum(["drop", "rise"]).optional(),
              snoozedUntil: z.string().optional(),
            }),
          ),
          stockWatches: z.array(
            z.object({
              id: z.string().min(1),
              productId: z.string().min(1),
              distributorId: z.string().min(1),
              lastKnownStatus: z.string().optional(),
            }),
          ),
          dateReminders: z.array(
            z.object({
              id: z.string().min(1),
              productId: z.string().min(1),
              distributorId: z.string().min(1),
              reminderDate: z.string().min(1),
            }),
          ),
          healthEvents: z
            .array(
              z.object({
                id: z.string().min(1),
                distributorId: z.string().min(1),
                distributorName: z.string().min(1),
                status: z.enum(["blocked", "error"]),
                title: z.string().min(1),
                body: z.string().min(1),
                createdAt: z.number(),
              }),
            )
            .optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
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
          },
          ctx.user.id,
        );
        return { accepted: true } as const;
      }),
    pull: protectedProcedure.input(z.object({})).query(async ({ ctx }) => {
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
  }),

  discovery: discoveryRouter,

  trending: trendingRouter,

  devices: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const devices = await listDevicesForUser(ctx.user.id);
      return { devices };
    }),
    current: protectedProcedure
      .input(z.object({ deviceId: z.string().min(1).max(128) }))
      .query(async ({ ctx, input }) => {
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
        const signedOut = await signOutDevice(ctx.user.id, input.deviceId);
        return { signedOut };
      }),
    cleanupStale: protectedProcedure.mutation(async ({ ctx }) => {
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
      .query(async ({ input }) => {
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
        const items = await db
          .select()
          .from(watchlistItems)
          .where(eq(watchlistItems.userId, row.ownerId));
        const products = items
          .filter((r) => r.deletedAtMs === null || r.deletedAtMs === undefined)
          .map((r) => r.data)
          .filter(Boolean);
        return { title: row.title, token: row.token, products, createdAt: row.createdAt?.toISOString?.() ?? null, expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null } as const;
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
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        await db.delete(sharedWatchlistMembers).where(and(eq(sharedWatchlistMembers.token, input.token), eq(sharedWatchlistMembers.userId, ctx.user.id)));
        return { left: true } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;

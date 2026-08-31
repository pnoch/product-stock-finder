import { z } from "zod";
import { TRPCError } from "@trpc/server";
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
  updatedAt: z.number(),
  deletedAt: z.number().nullable(),
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
  }),

  sync: router({
    pull: protectedProcedure
      .input(z.object({ since: z.number().nullable() }))
      .query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) {
          console.warn("[Sync] Database not available; returning empty pull");
          return { lastSyncedAt: Date.now(), items: [] };
        }
        // Capture the cursor before the SELECT so writes committed during
        // the query are not missed on the next pull.
        const lastSyncedAt = Date.now();
        const items = await listChangedItems(ctx.user.id, input.since);
        return { lastSyncedAt, items };
      }),
    push: protectedProcedure
      .input(z.object({ items: z.array(syncItemSchema).max(500) }))
      .mutation(async ({ ctx, input }) => {
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
        await purgeOldTombstones(
          ctx.user.id,
          Date.now() - TOMBSTONE_PURGE_WINDOW_MS,
        );
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
});

export type AppRouter = typeof appRouter;

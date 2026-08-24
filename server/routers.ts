import { z } from "zod";
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
import { getInsight } from "./price-insights";
import { getProductImage } from "./product-images";
import { parseProductText } from "./product-parse";
import type { SyncStampedItem } from "../lib/types";
import { upsertDeviceConfig, pullPendingEvents } from "./notifications";
import { upsertPushToken } from "./push-notifications";
import {
  listDevicesForUser,
  getDeviceBinding,
  renameDevice,
  signOutDevice,
  cleanupStaleDevices,
  STALE_DEVICE_MS,
} from "./devices";

const syncItemSchema = z.object({
  collection: z.enum(["watchlist", "alerts", "reminders", "settings"]),
  id: z.string(),
  data: z.unknown(),
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
        const items = await listChangedItems(ctx.user.id, input.since);
        return { lastSyncedAt: Date.now(), items };
      }),
    push: protectedProcedure
      .input(z.object({ items: z.array(syncItemSchema) }))
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
      .query(async ({ input }) => {
        return getPrice(input.distributorId, input.modelNumber);
      }),
    uploadHistory: publicProcedure
      .input(
        z.object({
          distributorId: z.string().min(1),
          modelNumber: z.string().min(1),
          points: z.array(
            z.object({
              date: z.string(),
              price: z.number(),
              currency: z.string(),
              stockStatus: z.enum([
                "in_stock",
                "back_order",
                "out_of_stock",
                "unknown",
              ]),
            }),
          ),
        }),
      )
      .mutation(async ({ input }) => {
        await mergeHistory(
          input.distributorId,
          input.modelNumber,
          input.points,
        );
        return { accepted: input.points.length } as const;
      }),
  }),

  fx: router({
    get: publicProcedure.query(async () => {
      return getFxRates();
    }),
  }),

  insights: router({
    get: publicProcedure
      .input(z.object({ productId: z.string().min(1) }))
      .query(async ({ input }) => {
        return getInsight(input.productId);
      }),
  }),

  images: router({
    get: publicProcedure
      .input(z.object({ productId: z.string().min(1) }))
      .query(async ({ input }) => {
        return getProductImage(input.productId);
      }),
  }),

  products: router({
    parse: publicProcedure
      .input(z.object({ raw: z.string().min(1).max(2000) }))
      .query(async ({ input }) => {
        return { product: await parseProductText(input.raw) };
      }),
  }),

  notifications: router({
    uploadConfig: publicProcedure
      .input(
        z.object({
          deviceId: z.string().min(1).max(128),
          alerts: z.array(
            z.object({
              id: z.string().min(1),
              productId: z.string().min(1),
              targetPrice: z.number(),
              currency: z.string().min(1),
              distributorId: z.string().optional(),
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
        await upsertDeviceConfig(
          input.deviceId,
          {
            alerts: input.alerts,
            stockWatches: input.stockWatches,
            dateReminders: input.dateReminders,
            healthEvents: input.healthEvents,
          },
          ctx.user?.id ?? null,
        );
        return { accepted: true } as const;
      }),
    pull: publicProcedure
      .input(z.object({ deviceId: z.string().min(1).max(128) }))
      .query(async ({ input, ctx }) => {
        const events = await pullPendingEvents(
          input.deviceId,
          ctx.user?.id ?? undefined,
        );
        return { events };
      }),
    registerPushToken: publicProcedure
      .input(
        z.object({
          deviceId: z.string().min(1).max(128),
          token: z.string().min(1).max(2048),
          platform: z.enum(["ios", "android", "web"]),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        await upsertPushToken(
          input.deviceId,
          input.token,
          input.platform,
          ctx.user?.id ?? null,
        );
        return { accepted: true } as const;
      }),
  }),

  devices: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const devices = await listDevicesForUser(ctx.user.id);
      return { devices };
    }),
    current: publicProcedure
      .input(z.object({ deviceId: z.string().min(1).max(128) }))
      .query(async ({ input }) => {
        const { userId } = await getDeviceBinding(input.deviceId);
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

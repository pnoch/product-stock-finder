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
import { mergeHistory } from "./price-history";
import { getInsight } from "./price-insights";
import { getProductImage } from "./product-images";
import { upsertDeviceConfig, pullPendingEvents } from "./notifications";

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
          return { accepted: 0 };
        }
        let accepted = 0;
        for (const item of input.items) {
          if (await upsertSyncItem(ctx.user.id, item)) accepted += 1;
        }
        await purgeOldTombstones(ctx.user.id, Date.now() - TOMBSTONE_PURGE_WINDOW_MS);
        return { accepted };
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
        await mergeHistory(input.distributorId, input.modelNumber, input.points);
        return { accepted: input.points.length } as const;
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

  notifications: router({
    uploadConfig: publicProcedure
      .input(
        z.object({
          deviceId: z.string().min(1),
          alerts: z.array(
            z.object({
              id: z.string().min(1),
              productId: z.string().min(1),
              targetPrice: z.number(),
              currency: z.string().min(1),
              distributorId: z.string().optional(),
            }),
          ),
          stockWatches: z.array(
            z.object({
              id: z.string().min(1),
              productId: z.string().min(1),
              distributorId: z.string().min(1),
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
        }),
      )
      .mutation(async ({ input }) => {
        await upsertDeviceConfig(input.deviceId, {
          alerts: input.alerts,
          stockWatches: input.stockWatches,
          dateReminders: input.dateReminders,
        });
        return { accepted: true } as const;
      }),
    pull: publicProcedure
      .input(z.object({ deviceId: z.string().min(1) }))
      .query(async ({ input }) => {
        const events = await pullPendingEvents(input.deviceId);
        return { events };
      }),
  }),
});

export type AppRouter = typeof appRouter;

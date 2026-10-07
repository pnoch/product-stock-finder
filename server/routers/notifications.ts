import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  MAX_UPLOAD_ALERTS,
  MAX_UPLOAD_STOCK_WATCHES,
  MAX_UPLOAD_DATE_REMINDERS,
  MAX_UPLOAD_HEALTH_EVENTS,
} from "../../shared/const.js";
import { protectedProcedure, router } from "../_core/trpc";
import { checkRateLimit } from "../rate-limit";
import { assertDeviceAccess } from "../devices";
import { upsertDeviceConfig, pullPendingEvents } from "../notifications";
import { upsertPushToken, pruneDeviceToken } from "../push-notifications";

export const notificationsRouter = router({
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
              // Lets the server resolve prices for products outside the
              // static catalog (manually added / rediscovered).
              modelNumber: z.string().max(191).optional(),
              targetPrice: z.number().finite().positive(),
              currency: z.string().min(1).max(8),
              distributorId: z.string().max(64).optional(),
              direction: z.enum(["drop", "rise"]).optional(),
              // Bounded + ISO-validated: persisted verbatim into a JSON
              // column, so an unbounded string is a storage-abuse vector.
              snoozedUntil: z
                .string()
                .max(64)
                .refine((v) => !Number.isNaN(Date.parse(v)), "invalid date")
                .optional(),
            }),
          )
          .max(MAX_UPLOAD_ALERTS),
        stockWatches: z
          .array(
            z.object({
              id: z.string().min(1).max(191),
              productId: z.string().min(1).max(191),
              modelNumber: z.string().max(191).optional(),
              distributorId: z.string().min(1).max(64),
              scope: z.enum(["distributor", "any"]).optional(),
              lastKnownStatus: z.string().max(32).optional(),
            }),
          )
          .max(MAX_UPLOAD_STOCK_WATCHES),
        dateReminders: z
          .array(
            z.object({
              id: z.string().min(1).max(191),
              productId: z.string().min(1).max(191),
              modelNumber: z.string().max(191).optional(),
              distributorId: z.string().min(1).max(64),
              reminderDate: z.string().min(1).max(64),
            }),
          )
          .max(MAX_UPLOAD_DATE_REMINDERS),
        healthEvents: z
          .array(
            z.object({
              // notification_events.id is varchar(128); a longer id would
              // fail the insert and 500 the whole upload.
              id: z.string().min(1).max(128),
              distributorId: z.string().min(1).max(64),
              distributorName: z.string().min(1).max(128),
              status: z.enum(["blocked", "error"]),
              kind: z.enum(["alert", "recovery"]).optional(),
              title: z.string().min(1).max(255),
              body: z.string().min(1).max(1000),
              // Bounded to now: a far-future createdAt would make the event
              // un-purgeable (retention deletes `createdAt < cutoff`).
              createdAt: z
                .number()
                .int()
                .nonnegative()
                .max(Date.now() + 60_000),
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
          // An explicit null clears the setting; an absent field (older
          // clients) must not wipe a newer client's quiet hours.
          .nullable()
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
      // Reject a web subscription whose endpoint is not a real push service:
      // it would otherwise be used as an SSRF target at send time.
      if (input.platform === "web") {
        let endpoint = "";
        try {
          endpoint = (JSON.parse(input.token) as { endpoint?: string }).endpoint ?? "";
        } catch {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid web push subscription",
          });
        }
        const { isAllowedPushEndpoint } = await import("../web-push");
        if (!isAllowedPushEndpoint(endpoint)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Unsupported push endpoint",
          });
        }
      }
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
  testWebhook: protectedProcedure
    .input(z.object({ url: z.string().min(1).max(2048) }))
    .mutation(async ({ input, ctx }) => {
      // Intentionally not device-scoped: it only POSTs a caller-supplied, allowlist-validated URL.
      checkRateLimit(ctx, "notifications.testWebhook", 5, 60_000);
      const { sendTestWebhook } = await import("../notifications/webhook-alerts");
      return sendTestWebhook(input.url);
    }),
});

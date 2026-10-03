import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  MAX_UPLOAD_ALERTS,
  MAX_UPLOAD_DATE_REMINDERS,
  MAX_UPLOAD_HEALTH_EVENTS,
  MAX_UPLOAD_STOCK_WATCHES,
} from "../shared/const.js";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { getDb, getUserByEmail, getUserById } from "./db";
import { sharedWatchlists, sharedWatchlistMembers, watchlistItems } from "../drizzle/schema";
import { llmRouter } from "./routers/llm";
import { isDuplicateKeyError, isForeignKeyError } from "./db-errors";
import { checkRateLimit, checkRateLimitByKey } from "./rate-limit";
import { discoveryRouter } from "./routers/discovery";
import { trendingRouter } from "./routers/trending";
import { healthRouter } from "./routers/health";
import { fxRouter } from "./routers/fx";
import { insightsRouter } from "./routers/insights";
import { imagesRouter } from "./routers/images";
import { productsRouter } from "./routers/products";
import { authRouter } from "./routers/auth";
import { syncRouter } from "./routers/sync";
import { pricesRouter } from "./routers/prices";
import { getOrigin } from "./routers/helpers";
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

export { getOrigin } from "./routers/helpers";
export { clearHealthCacheForTests } from "./routers/health";

// Public share links return the owner's watchlist; cap the payload so a very
// large watchlist can't turn the endpoint into an expensive unbounded read.
const SHARED_WATCHLIST_MAX_ITEMS = 500;

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: authRouter,

  sync: syncRouter,

  prices: pricesRouter,

  health: healthRouter,

  fx: fxRouter,

  insights: insightsRouter,

  images: imagesRouter,

  products: productsRouter,

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
          const { isAllowedPushEndpoint } = await import("./web-push");
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
        const { sendTestWebhook } = await import("./notifications/webhook-alerts");
        return sendTestWebhook(input.url);
      }),
  }),

  discovery: discoveryRouter,

  llm: llmRouter,

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
            // `isDuplicateKeyError` unwraps Drizzle's DrizzleQueryError, whose
            // message is "Failed query: ..." — the old substring check never
            // matched, so a (vanishingly unlikely) token collision threw.
            if (isDuplicateKeyError(e) && attempt < 2) { token = randomUUID(); continue; }
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
        const row = rows[0] as unknown as { ownerId: number; token: string; title: string; createdAt: Date; expiresAt: Date | null; updatedAt?: Date; membersOnly?: boolean } | undefined;
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
        if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
          await db.delete(sharedWatchlists).where(eq(sharedWatchlists.token, input.token));
          throw new TRPCError({ code: "NOT_FOUND", message: "Share expired" });
        }
        // Membership (for the viewer's Join/Leave control). `get` is public, so
        // this is best-effort: signed-out viewers simply get false/false.
        const viewerId = ctx.user?.id ?? null;
        const isOwner = viewerId !== null && row.ownerId === viewerId;
        let isMember = false;
        if (viewerId !== null && !isOwner) {
          const memberRows = await db
            .select()
            .from(sharedWatchlistMembers)
            .where(
              and(
                eq(sharedWatchlistMembers.token, input.token),
                eq(sharedWatchlistMembers.userId, viewerId),
              ),
            )
            .limit(1);
          isMember = memberRows.length > 0;
        }
        // Members-only shares: the token alone is not sufficient. Actionable
        // message (the caller already holds the token, so this leaks nothing).
        if (row.membersOnly && !isOwner && !isMember) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "This share is members-only. Ask the owner to invite you.",
          });
        }
        // Cap the shared payload: a public endpoint must not return an
        // arbitrarily large watchlist (or read every row into memory) just
        // because the owner has thousands of items.
        // Filter tombstones in SQL: counting them toward the cap truncated the
        // live products for an owner with many deletions.
        // Fetch one past the cap so a share with exactly MAX items is not
        // misreported as truncated (the extra row is dropped before returning).
        const items = await db
          .select()
          .from(watchlistItems)
          .where(
            and(
              eq(watchlistItems.userId, row.ownerId),
              isNull(watchlistItems.deletedAtMs),
            ),
          )
          .limit(SHARED_WATCHLIST_MAX_ITEMS + 1);
        const truncated = items.length > SHARED_WATCHLIST_MAX_ITEMS;
        const products = items
          .slice(0, SHARED_WATCHLIST_MAX_ITEMS)
          .map((r) => r.data)
          .filter(Boolean);
        return { title: row.title, token: row.token, products, truncated, createdAt: row.createdAt?.toISOString?.() ?? null, expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null, isOwner, isMember } as const;
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
        links: (rows as unknown as { token: string; title: string; createdAt: Date | null; expiresAt: Date | null; membersOnly: boolean }[]).map((r) => ({
          token: r.token,
          title: r.title,
          shareUrl: `${origin}/w/${r.token}`,
          createdAt: r.createdAt?.toISOString?.() ?? null,
          expiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
          membersOnly: Boolean(r.membersOnly),
        })),
      } as const;
    }),
    listJoined: protectedProcedure.query(async ({ ctx }) => {
      checkRateLimit(ctx, "sharedWatchlists.listJoined", 30, 60_000);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      const memberRows = await db
        .select()
        .from(sharedWatchlistMembers)
        .where(eq(sharedWatchlistMembers.userId, ctx.user.id));
      const origin = getOrigin(ctx.req as unknown as { headers: Record<string, unknown> });
      const joined = await Promise.all(
        memberRows.map(async (m) => {
          const rows = await db
            .select()
            .from(sharedWatchlists)
            .where(eq(sharedWatchlists.token, m.token))
            .limit(1);
          const share = rows[0] as unknown as
            | { ownerId: number; token: string; title: string; expiresAt: Date | null; membersOnly: boolean }
            | undefined;
          if (!share) return null;
          // Drop expired shares (get/members reject them) so the list can't
          // point at a dead link.
          if (share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()) {
            return null;
          }
          const owner = await getUserById(share.ownerId);
          return {
            token: share.token,
            title: share.title,
            shareUrl: `${origin}/w/${share.token}`,
            ownerName: owner?.name ?? owner?.email ?? null,
            expiresAt: share.expiresAt ? new Date(share.expiresAt).toISOString() : null,
            membersOnly: Boolean(share.membersOnly),
          };
        }),
      );
      return { shares: joined.filter((s): s is NonNullable<typeof s> => s !== null) } as const;
    }),
    setMembersOnly: protectedProcedure
      .input(
        z.object({
          token: z.string().min(1).max(64),
          membersOnly: z.boolean(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(ctx, "sharedWatchlists.setMembersOnly", 20, 60_000);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const rows = await db.select().from(sharedWatchlists).where(eq(sharedWatchlists.token, input.token)).limit(1);
        const row = rows[0] as unknown as { ownerId: number } | undefined;
        if (!row || row.ownerId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
        await db
          .update(sharedWatchlists)
          .set({ membersOnly: input.membersOnly })
          .where(and(eq(sharedWatchlists.token, input.token), eq(sharedWatchlists.ownerId, ctx.user.id)));
        return { membersOnly: input.membersOnly } as const;
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
        const row = rows[0] as unknown as { ownerId: number; expiresAt: Date | null } | undefined;
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
        if (row.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only owner can invite" });
        // Expired shares must not accept new members (get/members/join all
        // reject them), or an invite silently grants access to a dead share.
        if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Share expired" });
        }
        try {
          await db.insert(sharedWatchlistMembers).values({ token: input.token, userId: input.userId, role: input.role }).onDuplicateKeyUpdate({ set: { role: input.role } });
        } catch (e) {
          // A stale/unknown user id is a normal validation case; the FK error
          // used to surface as INTERNAL_SERVER_ERROR (inviteByEmail already
          // returns NOT_FOUND for it).
          if (isForeignKeyError(e)) {
            throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
          }
          throw e;
        }
        return { invited: true } as const;
      }),
    members: protectedProcedure
      .input(z.object({ token: z.string().min(1).max(64) }))
      .query(async ({ ctx, input }) => {
        checkRateLimit(ctx, "sharedWatchlists.members", 30, 60_000);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const rows = await db.select().from(sharedWatchlists).where(eq(sharedWatchlists.token, input.token)).limit(1);
        const row = rows[0] as unknown as { ownerId: number; expiresAt: Date | null } | undefined;
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
        if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Share expired" });
        }
        const isOwner = row.ownerId === ctx.user.id;
        const memberRows = await db.select().from(sharedWatchlistMembers).where(eq(sharedWatchlistMembers.token, input.token));
        const isMember = memberRows.some((m) => m.userId === ctx.user.id);
        if (!isOwner && !isMember) throw new TRPCError({ code: "FORBIDDEN", message: "Not a member" });
        // Resolve display names for the roster UI — the raw rows only carry
        // userId/role, which the owner cannot map to a person.
        const members = await Promise.all(
          memberRows.map(async (m) => {
            const u = await getUserById(m.userId);
            return {
              userId: m.userId,
              role: m.role,
              name: u?.name ?? null,
              email: u?.email ?? null,
            };
          }),
        );
        return { members } as const;
      }),
    inviteByEmail: protectedProcedure
      .input(
        z.object({
          token: z.string().min(1).max(64),
          email: z.string().min(3).max(191),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(ctx, "sharedWatchlists.inviteByEmail", 20, 60_000);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const rows = await db.select().from(sharedWatchlists).where(eq(sharedWatchlists.token, input.token)).limit(1);
        const row = rows[0] as unknown as { ownerId: number; expiresAt: Date | null } | undefined;
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
        if (row.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only owner can invite" });
        if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Share expired" });
        }
        // Emails are stored normalised (lowercased) at signup, so match exactly
        // and don't prefix-search (that would let an owner enumerate accounts).
        const target = await getUserByEmail(input.email.trim().toLowerCase());
        if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "No account with that email" });
        if (target.id === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "You already own this share" });
        // Invitations are viewer-only: the `editor` role has no enforced
        // capabilities, so offering it would imply powers that don't exist.
        await db
          .insert(sharedWatchlistMembers)
          .values({ token: input.token, userId: target.id, role: "viewer" })
          .onDuplicateKeyUpdate({ set: { role: "viewer" } });
        return { invited: true, name: target.name ?? target.email ?? "member" } as const;
      }),
    removeMember: protectedProcedure
      .input(
        z.object({
          token: z.string().min(1).max(64),
          userId: z.number().int().positive(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(ctx, "sharedWatchlists.removeMember", 20, 60_000);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const rows = await db.select().from(sharedWatchlists).where(eq(sharedWatchlists.token, input.token)).limit(1);
        const row = rows[0] as unknown as { ownerId: number } | undefined;
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
        if (row.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only owner can remove members" });
        await db
          .delete(sharedWatchlistMembers)
          .where(
            and(
              eq(sharedWatchlistMembers.token, input.token),
              eq(sharedWatchlistMembers.userId, input.userId),
            ),
          );
        return { removed: true } as const;
      }),
    join: protectedProcedure
      .input(z.object({ token: z.string().min(1).max(64) }))
      .mutation(async ({ ctx, input }) => {
        checkRateLimit(ctx, "sharedWatchlists.join", 20, 60_000);
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        const rows = await db.select().from(sharedWatchlists).where(eq(sharedWatchlists.token, input.token)).limit(1);
        const joinRow = rows[0] as unknown as {
          expiresAt: Date | null;
          membersOnly?: boolean | null;
        } | undefined;
        if (!joinRow) throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
        // Expired shares must not be joinable (get already rejects them).
        if (joinRow.expiresAt && new Date(joinRow.expiresAt).getTime() < Date.now()) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Share expired" });
        }
        // A members-only share is invite-only: joining must not be a way around
        // the invitation (get already gates on membership, so an unconditional
        // insert here made the setting unenforceable for any token holder).
        if (joinRow.membersOnly) {
          const existing = await db
            .select()
            .from(sharedWatchlistMembers)
            .where(
              and(
                eq(sharedWatchlistMembers.token, input.token),
                eq(sharedWatchlistMembers.userId, ctx.user.id),
              ),
            )
            .limit(1);
          if (existing.length === 0) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "This share is invite-only. Ask the owner to invite you.",
            });
          }
        }
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

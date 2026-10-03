import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { randomUUID } from "crypto";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb, getUserByEmail, getUserById } from "../db";
import {
  sharedWatchlists,
  sharedWatchlistMembers,
  watchlistItems,
} from "../../drizzle/schema";
import { isDuplicateKeyError, isForeignKeyError } from "../db-errors";
import { checkRateLimit, checkRateLimitByKey } from "../rate-limit";
import { getOrigin } from "./helpers";

// Public share links return the owner's watchlist; cap the payload so a very
// large watchlist can't turn the endpoint into an expensive unbounded read.
const SHARED_WATCHLIST_MAX_ITEMS = 500;

export const sharedWatchlistsRouter = router({
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
      const origin = getOrigin(ctx.req);
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
      const row = rows[0];
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
    const origin = getOrigin(ctx.req);
    return {
      links: rows.map((r) => ({
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
    const origin = getOrigin(ctx.req);
    const joined = await Promise.all(
      memberRows.map(async (m) => {
        const rows = await db
          .select()
          .from(sharedWatchlists)
          .where(eq(sharedWatchlists.token, m.token))
          .limit(1);
        const share = rows[0];
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
      const row = rows[0];
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
      const row = rows[0];
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
      const row = rows[0];
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
      const row = rows[0];
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
      const row = rows[0];
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
      const row = rows[0];
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
      const joinRow = rows[0];
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
});

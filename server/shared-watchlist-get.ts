import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import {
  sharedWatchlistMembers,
  sharedWatchlists,
  watchlistItems,
} from "../drizzle/schema";
import type { getDb } from "./db";

const SHARED_WATCHLIST_MAX_ITEMS = 500;

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export async function getSharedWatchlist(
  db: Db,
  token: string,
  viewerId: number | null,
) {
  const rows = await db
    .select()
    .from(sharedWatchlists)
    .where(eq(sharedWatchlists.token, token))
    .limit(1);
  const row = rows[0];
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Share not found" });
  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
    await db.delete(sharedWatchlists).where(eq(sharedWatchlists.token, token));
    throw new TRPCError({ code: "NOT_FOUND", message: "Share expired" });
  }
  // Membership (for the viewer's Join/Leave control). `get` is public, so
  // this is best-effort: signed-out viewers simply get false/false.
  const isOwner = viewerId !== null && row.ownerId === viewerId;
  let isMember = false;
  if (viewerId !== null && !isOwner) {
    const memberRows = await db
      .select()
      .from(sharedWatchlistMembers)
      .where(
        and(
          eq(sharedWatchlistMembers.token, token),
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
  // Cap the shared payload: a public endpoint must not return an arbitrarily
  // large watchlist (or read every row into memory) just because the owner has
  // thousands of items. Filter tombstones in SQL: counting them toward the cap
  // truncated the live products for an owner with many deletions. Fetch one
  // past the cap so a share with exactly MAX items is not misreported as
  // truncated (the extra row is dropped before returning).
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
  return {
    title: row.title,
    token: row.token,
    products,
    truncated,
    createdAt: row.createdAt?.toISOString?.() ?? null,
    expiresAt: row.expiresAt ? new Date(row.expiresAt).toISOString() : null,
    isOwner,
    isMember,
  } as const;
}

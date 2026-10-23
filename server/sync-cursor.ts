import { and, eq, gt, gte, or, type SQLWrapper } from "drizzle-orm";

export interface SyncCursor {
  stamp: number;
  collection: string;
  id: string;
}

// Deterministic global page order is (effectiveStamp, collection, id) ascending.
// A stamp-only cursor cannot page correctly: many rows can share a stamp (bulk
// edits, tombstones), so `>= stamp` would return the same page forever and the
// client would stop with rows undelivered. The composite cursor makes the order
// total, so each page is strictly after the previous one.
// Canonical collection order. MUST match COLLECTION_ORDER in
// server/routers.ts (which sorts the merged page and builds the cursor):
// comparing collection names lexicographically here while the router sorts by
// this array made the two orders disagree, so a page boundary could skip rows
// in a collection that sorts earlier lexicographically but later here.
export const SYNC_COLLECTION_ORDER = [
  "watchlist",
  "alerts",
  "reminders",
  "settings",
] as const;

function collectionRank(collection: string): number {
  const idx = (SYNC_COLLECTION_ORDER as readonly string[]).indexOf(collection);
  return idx === -1 ? SYNC_COLLECTION_ORDER.length : idx;
}

export function afterCursor(
  stampExpr: SQLWrapper,
  collection: string,
  idExpr: SQLWrapper,
  cursor: SyncCursor | null,
): SQLWrapper | undefined {
  if (!cursor) return undefined;
  const rank = collectionRank(collection);
  const cursorRank = collectionRank(cursor.collection);
  if (rank > cursorRank) {
    // Later collection: any row at the same stamp sorts after the cursor.
    return gte(stampExpr, cursor.stamp);
  }
  if (rank === cursorRank) {
    return or(
      gt(stampExpr, cursor.stamp),
      and(eq(stampExpr, cursor.stamp), gt(idExpr, cursor.id)),
    );
  }
  // Earlier collection: only strictly newer stamps come after the cursor.
  return gt(stampExpr, cursor.stamp);
}

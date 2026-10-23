import type { SyncItem } from "../types";

export interface PullResult {
  lastSyncedAt: number;
  items: SyncItem[];
  fullResyncSince?: number | null;
  hasMore?: boolean;
  nextCursor?: { stamp: number; collection: string; id: string } | null;
}

export type PullFn = (
  since: number | null,
  cursor?: { stamp: number; collection: string; id: string } | null,
) => Promise<PullResult>;

// The server caps each pull; without draining, a large account would only ever
// receive the first page. `nextCursor` is the newest stamp seen so far, and the
// server re-includes rows at that stamp so a page boundary cannot skip an item
// (the client dedupes by key).
export async function pullAllPages(
  pull: PullFn,
  since: number | null,
): Promise<PullResult> {
  let pulled = await pull(since);
  let guard = 0;
  while (pulled.hasMore && pulled.nextCursor && guard < 50) {
    guard += 1;
    const next = await pull(since, pulled.nextCursor);
    if (next.items.length === 0) break;
    pulled = {
      lastSyncedAt: next.lastSyncedAt,
      items: [...pulled.items, ...next.items],
      fullResyncSince: pulled.fullResyncSince ?? next.fullResyncSince,
      hasMore: next.hasMore,
      nextCursor: next.nextCursor,
    };
  }
  return pulled;
}

import type { PriceSnapshot } from "./types";
import { PRICE_SNAPSHOT_TTL_MS } from "@/shared/const";

/**
 * True when a server snapshot is fresh enough to present as a current price.
 * Stale snapshots are still useful for history merging, but must never be
 * stamped as just-checked. Slightly future-dated snapshots (clock skew) are
 * treated as fresh.
 */
export function isFreshPriceSnapshot(
  snapshot: PriceSnapshot | null | undefined,
  now: number = Date.now(),
): snapshot is PriceSnapshot {
  if (!snapshot) return false;
  if (!Number.isFinite(snapshot.fetchedAt)) return false;
  return now - snapshot.fetchedAt < PRICE_SNAPSHOT_TTL_MS;
}

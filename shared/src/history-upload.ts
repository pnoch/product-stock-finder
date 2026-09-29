import { MAX_UPLOAD_HISTORY_POINTS } from "../const";

// Mirrors the server's prices.uploadHistory zod schema (server/routers.ts).
// A single point that fails any of these checks makes the server reject the
// WHOLE listing's payload, so a legacy or corrupt point would silently drop the
// rest of a listing's history. Filter here instead.
const ISO_UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
// decimal(12,4): a larger value fails the insert.
const MAX_PRICE = 99_999_999;
const MAX_FUTURE_SKEW_MS = 3_600_000;
const STOCK_STATUSES = new Set([
  "in_stock",
  "back_order",
  "out_of_stock",
  "unknown",
]);

export interface UploadablePoint {
  date: string;
  price: number;
  currency: string;
  stockStatus: string;
}

/**
 * Keeps only the points the server's uploadHistory schema accepts, then trims
 * to the newest MAX_UPLOAD_HISTORY_POINTS.
 *
 * Sorts by parsed time before trimming: a history restored from a backup or a
 * server pull is not guaranteed ascending, and `slice(-N)` on a descending
 * array kept the OLDEST points instead of the newest.
 */
export function sanitizeHistoryPoints<T extends UploadablePoint>(
  points: T[],
): T[] {
  const now = Date.now();
  const valid = points.filter((p) => {
    if (typeof p.date !== "string" || !ISO_UTC_INSTANT.test(p.date)) {
      return false;
    }
    const t = Date.parse(p.date);
    if (Number.isNaN(t) || t > now + MAX_FUTURE_SKEW_MS) return false;
    if (!Number.isFinite(p.price) || p.price <= 0 || p.price > MAX_PRICE) {
      return false;
    }
    if (
      typeof p.currency !== "string" ||
      p.currency.length === 0 ||
      p.currency.length > 8
    ) {
      return false;
    }
    return STOCK_STATUSES.has(p.stockStatus);
  });
  if (valid.length <= MAX_UPLOAD_HISTORY_POINTS) return valid;
  return valid
    .slice()
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .slice(-MAX_UPLOAD_HISTORY_POINTS);
}

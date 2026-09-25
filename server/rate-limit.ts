import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";

interface Bucket {
  /** The window this key was last used with; each bucket is pruned by its own. */
  windowMs: number;
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();
let lastPrune = Date.now();
const PRUNE_INTERVAL = 60_000;
// Hard cap on distinct keys. Under a rotating-IP flood every key stays "active"
// for the full window, so time-based pruning alone lets the map grow without
// bound. Evicting the oldest-inserted keys keeps memory bounded; an evicted
// client simply gets a fresh bucket.
const MAX_BUCKETS = 10_000;

// Prunes every bucket by ITS OWN window. Pruning with the calling endpoint's
// window instead let a short-window call truncate a long-window bucket's
// history to the caller's window, silently loosening that endpoint's limit.
function pruneStale() {
  const now = Date.now();
  if (now - lastPrune < PRUNE_INTERVAL) return;
  lastPrune = now;
  for (const [key, bucket] of buckets) {
    const cutoff = now - bucket.windowMs;
    const recent = bucket.timestamps.filter((t) => t > cutoff);
    if (recent.length === 0) buckets.delete(key);
    else bucket.timestamps = recent;
  }
  // Map preserves insertion order, so the first keys are the oldest.
  while (buckets.size > MAX_BUCKETS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}

function getClientIp(req: TrpcContext["req"]): string {
  // Express resolves `req.ip` from the socket address, and — only when
  // `trust proxy` is configured — from X-Forwarded-For, taking the address
  // added by the trusted hop. Reading the raw leftmost XFF entry here would
  // let a client spoof its own key and bypass every bucket.
  return (
    (req as unknown as { ip?: string }).ip ??
    (req.socket as unknown as { remoteAddress?: string })?.remoteAddress ??
    "unknown"
  );
}

function clientKey(ctx: TrpcContext): string {
  return getClientIp(ctx.req);
}

export function checkRateLimit(
  ctx: TrpcContext,
  endpoint: string,
  limit: number,
  windowMs: number,
): void {
  // Skip in test to avoid flaky cross-test bucket pollution (tests mock context with static ip)
  if (process.env.NODE_ENV === "test" && clientKey(ctx) === "unknown") return;
  consumeBucket(`${endpoint}:${clientKey(ctx)}`, limit, windowMs);
}

// Rate limit keyed on an arbitrary value (e.g. a share token) rather than the
// client IP, so a caller rotating source addresses still hits one budget.
export function checkRateLimitByKey(
  key: string,
  limit: number,
  windowMs: number,
): void {
  consumeBucket(key, limit, windowMs);
}

function consumeBucket(key: string, limit: number, windowMs: number): void {
  pruneStale();
  const now = Date.now();
  const windowStart = now - windowMs;
  const bucket = buckets.get(key) ?? { windowMs, timestamps: [] };
  bucket.windowMs = windowMs;
  const recent = bucket.timestamps.filter((t) => t > windowStart);
  if (recent.length >= limit) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Rate limit exceeded. Try again shortly.",
    });
  }
  recent.push(now);
  bucket.timestamps = recent;
  // Re-inserting an existing key moves it to the end of the insertion order,
  // making the map an LRU: eviction below drops the least-recently-used bucket.
  buckets.delete(key);
  buckets.set(key, bucket);
  // Enforce the cap on insert too, not only during the 60s prune: a burst of
  // unique keys between prunes would otherwise grow the map unbounded.
  while (buckets.size > MAX_BUCKETS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) break;
    buckets.delete(oldest);
  }
}

export function clearRateLimitsForTests(): void {
  buckets.clear();
}

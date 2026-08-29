import { TRPCError } from "@trpc/server";
import type { TrpcContext } from "./_core/context";

const buckets = new Map<string, number[]>();
let lastPrune = Date.now();
const PRUNE_INTERVAL = 60_000;

function pruneStale(maxAge: number) {
  const now = Date.now();
  if (now - lastPrune < PRUNE_INTERVAL) return;
  lastPrune = now;
  const cutoff = now - maxAge;
  for (const [key, timestamps] of buckets) {
    const recent = timestamps.filter((t) => t > cutoff);
    if (recent.length === 0) buckets.delete(key);
    else buckets.set(key, recent);
  }
}

function clientKey(ctx: TrpcContext): string {
  const xf = ctx.req.headers["x-forwarded-for"];
  const forwarded =
    typeof xf === "string" ? xf.split(",")[0]?.trim() : undefined;
  const ip =
    forwarded ??
    (ctx.req as unknown as { ip?: string }).ip ??
    (ctx.req.socket as unknown as { remoteAddress?: string })?.remoteAddress ??
    "unknown";
  return ip;
}

export function checkRateLimit(
  ctx: TrpcContext,
  endpoint: string,
  limit: number,
  windowMs: number,
): void {
  // Skip in test to avoid flaky cross-test bucket pollution (tests mock context with static ip)
  if (process.env.NODE_ENV === "test" && clientKey(ctx) === "unknown") return;
  pruneStale(windowMs);
  const key = `${endpoint}:${clientKey(ctx)}`;
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = buckets.get(key) ?? [];
  const recent = timestamps.filter((t) => t > windowStart);
  if (recent.length >= limit) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Rate limit exceeded. Try again shortly.",
    });
  }
  recent.push(now);
  buckets.set(key, recent);
}

export function clearRateLimitsForTests(): void {
  buckets.clear();
}

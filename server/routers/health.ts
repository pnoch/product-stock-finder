import { router, publicProcedure } from "../_core/trpc";
import { checkRateLimit } from "../rate-limit";
import { checkAllDistributors } from "../health";

// Short server cache: one health.check fans out to ~25 distributor scrapes,
// so repeat calls within the window reuse the previous result instead of
// re-scraping (rate limiting alone still allows 125 scrapes/min/IP).
const HEALTH_CACHE_TTL_MS = 5 * 60 * 1000;
let healthCache: {
  at: number;
  result: Awaited<ReturnType<typeof checkAllDistributors>> | null;
} = {
  at: 0,
  result: null,
};
let healthInFlight: Promise<Awaited<ReturnType<typeof checkAllDistributors>>> | null = null;

export function clearHealthCacheForTests(): void {
  healthCache = { at: 0, result: null };
}

export const healthRouter = router({
  check: publicProcedure.query(async ({ ctx }) => {
    checkRateLimit(ctx, "health.check", 5, 60_000);
    const now = Date.now();
    if (
      healthCache.result !== null &&
      now - healthCache.at < HEALTH_CACHE_TTL_MS
    ) {
      return healthCache.result;
    }
    // Single-flight: concurrent cold calls (many IPs bypassing the per-IP
    // limit) would otherwise each launch a full 25-distributor scan.
    if (!healthInFlight) {
      healthInFlight = checkAllDistributors()
        .then((result) => {
          healthCache = { at: Date.now(), result };
          return result;
        })
        .finally(() => {
          healthInFlight = null;
        });
    }
    return healthInFlight;
  }),
});

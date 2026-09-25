import { describe, expect, it, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  checkRateLimitByKey,
  clearRateLimitsForTests,
} from "../server/rate-limit";

describe("checkRateLimitByKey", () => {
  beforeEach(() => clearRateLimitsForTests());

  it("enforces the limit for a key independent of client IP", () => {
    checkRateLimitByKey("token:abc", 2, 60_000);
    checkRateLimitByKey("token:abc", 2, 60_000);
    try {
      checkRateLimitByKey("token:abc", 2, 60_000);
      expect.unreachable("expected TOO_MANY_REQUESTS");
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe("TOO_MANY_REQUESTS");
    }
  });

  it("isolates buckets per key", () => {
    checkRateLimitByKey("token:a", 1, 60_000);
    expect(() => checkRateLimitByKey("token:b", 1, 60_000)).not.toThrow();
  });

  // QA round 291: `pruneStale` used the *calling* endpoint's window, so a
  // short-window call truncated every long-window bucket's history down to the
  // caller's window — silently loosening that endpoint's limit. Prune each
  // bucket by its own window instead.
  it("does not let a short-window call loosen a long-window bucket", () => {
    vi.useFakeTimers();
    try {
      const t0 = Date.now();
      // Fill a 1h-window bucket (limit 3) with three calls spread over 4 min.
      for (const offsetMin of [0, 2, 4]) {
        vi.setSystemTime(t0 + offsetMin * 60_000);
        checkRateLimitByKey("long:key", 3, 3_600_000);
      }
      // >60s after the last prune-triggering call, a short-window call runs the
      // 60s prune. With the old code it dropped all three long-bucket entries.
      vi.setSystemTime(t0 + 4 * 60_000 + 61_000);
      checkRateLimitByKey("short:key", 100, 60_000);
      // Still inside the long window, so the 4th call must be refused.
      expect(() => checkRateLimitByKey("long:key", 3, 3_600_000)).toThrow(
        /Rate limit/,
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

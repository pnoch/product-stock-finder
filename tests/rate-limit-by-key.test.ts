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
});

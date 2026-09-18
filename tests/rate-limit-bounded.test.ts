import { describe, expect, it, beforeEach } from "vitest";
import {
  checkRateLimitByKey,
  clearRateLimitsForTests,
} from "../server/rate-limit";

describe("rate-limit bucket map is bounded", () => {
  beforeEach(() => clearRateLimitsForTests());

  it("evicts the least-recently-used bucket past the cap", () => {
    // MAX_BUCKETS is 10_000; fill past it and confirm the map does not grow
    // without bound (the first key is evicted, a recent one survives).
    for (let i = 0; i < 10_050; i++) {
      checkRateLimitByKey(`k${i}`, 5, 60_000);
    }
    // The very first key was evicted, so it gets a fresh bucket (no throw).
    expect(() => checkRateLimitByKey("k0", 1, 60_000)).not.toThrow();
    // A recent key still has its history, so limit=1 is already exceeded.
    expect(() => checkRateLimitByKey("k10049", 1, 60_000)).toThrow();
  });
});

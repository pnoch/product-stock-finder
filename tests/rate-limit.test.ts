import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  checkRateLimit,
  clearRateLimitsForTests,
} from "../server/rate-limit";

function makeCtx(opts: {
  ip?: string;
  xff?: string;
  trustProxy?: unknown;
} = {}) {
  const req: any = { headers: {}, socket: {} };
  if (opts.ip !== undefined) {
    req.ip = opts.ip;
    req.socket.remoteAddress = opts.ip;
  } else {
    // Concrete IP by default so enforcement is not skipped
    // (rate-limit.ts skips when NODE_ENV === "test" and IP is "unknown").
    req.ip = "1.2.3.4";
    req.socket.remoteAddress = "1.2.3.4";
  }
  if (opts.xff !== undefined) {
    req.headers["x-forwarded-for"] = opts.xff;
  }
  if (opts.trustProxy !== undefined) {
    req.app = {
      get: (k: string) => (k === "trust proxy" ? opts.trustProxy : undefined),
    };
  }
  return { req } as any;
}

function expectTooManyRequests(fn: () => void) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(TRPCError);
    expect((e as TRPCError).code).toBe("TOO_MANY_REQUESTS");
    return;
  }
  expect.unreachable("expected TOO_MANY_REQUESTS to be thrown");
}

describe("rate-limit", () => {
  beforeEach(() => {
    clearRateLimitsForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows calls under the limit", () => {
    const ctx = makeCtx({ ip: "1.2.3.4" });
    expect(() => checkRateLimit(ctx, "under-limit", 3, 60_000)).not.toThrow();
    expect(() => checkRateLimit(ctx, "under-limit", 3, 60_000)).not.toThrow();
    expect(() => checkRateLimit(ctx, "under-limit", 3, 60_000)).not.toThrow();
  });

  it("throws TOO_MANY_REQUESTS at limit + 1", () => {
    const ctx = makeCtx({ ip: "1.2.3.4" });
    checkRateLimit(ctx, "at-limit", 2, 60_000);
    checkRateLimit(ctx, "at-limit", 2, 60_000);
    expectTooManyRequests(() => checkRateLimit(ctx, "at-limit", 2, 60_000));
  });

  it("allows calls again after the window expires", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(1_000_000);
      const ctx = makeCtx({ ip: "1.2.3.4" });
      checkRateLimit(ctx, "window-expiry", 2, 1000);
      checkRateLimit(ctx, "window-expiry", 2, 1000);
      expectTooManyRequests(() =>
        checkRateLimit(ctx, "window-expiry", 2, 1000),
      );
      vi.setSystemTime(1_000_000 + 1001);
      expect(() =>
        checkRateLimit(ctx, "window-expiry", 2, 1000),
      ).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it("isolates buckets per endpoint", () => {
    const ctx = makeCtx({ ip: "1.2.3.4" });
    checkRateLimit(ctx, "endpoint-a", 1, 60_000);
    expectTooManyRequests(() => checkRateLimit(ctx, "endpoint-a", 1, 60_000));
    expect(() => checkRateLimit(ctx, "endpoint-b", 1, 60_000)).not.toThrow();
  });

  it("isolates buckets per client IP", () => {
    const ctxA = makeCtx({ ip: "1.2.3.4" });
    const ctxB = makeCtx({ ip: "5.6.7.8" });
    checkRateLimit(ctxA, "per-ip", 1, 60_000);
    expectTooManyRequests(() => checkRateLimit(ctxA, "per-ip", 1, 60_000));
    expect(() => checkRateLimit(ctxB, "per-ip", 1, 60_000)).not.toThrow();
  });

  it("does not drop fresh buckets when pruning runs", () => {
    vi.useFakeTimers();
    try {
      const base = Date.now();
      vi.setSystemTime(base);
      const ctx = makeCtx({ ip: "1.2.3.4" });
      checkRateLimit(ctx, "prune-fresh", 1, 10 * 60_000);
      // Advance past the 60s prune interval; the bucket is still well
      // within its 10-minute window so it must survive pruning.
      vi.setSystemTime(base + 61_000);
      expectTooManyRequests(() =>
        checkRateLimit(ctx, "prune-fresh", 1, 10 * 60_000),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignores X-Forwarded-For without trust proxy", () => {
    const ctxA = makeCtx({ ip: "1.2.3.4", xff: "9.9.9.9" });
    const ctxB = makeCtx({ ip: "1.2.3.4", xff: "8.8.8.8" });
    const ctxOtherIp = makeCtx({ ip: "9.9.9.9" });
    checkRateLimit(ctxA, "xff-ignored", 1, 60_000);
    // Same socket IP but different XFF shares the bucket.
    expectTooManyRequests(() => checkRateLimit(ctxB, "xff-ignored", 1, 60_000));
    // The XFF value itself was not used as a key.
    expect(() =>
      checkRateLimit(ctxOtherIp, "xff-ignored", 1, 60_000),
    ).not.toThrow();
  });

  it("honors X-Forwarded-For with trust proxy", () => {
    const ctxForwarded = makeCtx({
      ip: "1.2.3.4",
      xff: "9.9.9.9",
      trustProxy: true,
    });
    const ctxDirect = makeCtx({ ip: "9.9.9.9" });
    checkRateLimit(ctxForwarded, "xff-honored", 1, 60_000);
    // Effective IP 9.9.9.9 is shared between the forwarded and direct ctx.
    expectTooManyRequests(() =>
      checkRateLimit(ctxDirect, "xff-honored", 1, 60_000),
    );
  });

  it("uses the first IP in X-Forwarded-For with trust proxy", () => {
    const ctxList = makeCtx({
      ip: "1.2.3.4",
      xff: "5.5.5.5, 6.6.6.6",
      trustProxy: 1,
    });
    const ctxFirst = makeCtx({ ip: "5.5.5.5" });
    const ctxSecond = makeCtx({ ip: "6.6.6.6" });
    checkRateLimit(ctxList, "xff-first", 1, 60_000);
    expectTooManyRequests(() => checkRateLimit(ctxFirst, "xff-first", 1, 60_000));
    expect(() =>
      checkRateLimit(ctxSecond, "xff-first", 1, 60_000),
    ).not.toThrow();
  });
});

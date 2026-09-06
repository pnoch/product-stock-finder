import { describe, expect, it } from "vitest";
import { isFreshPriceSnapshot } from "../lib/price-freshness";
import { PRICE_SNAPSHOT_TTL_MS } from "../shared/const";

function snapshotWith(fetchedAt: number) {
  return {
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "https://example.com/p",
    fetchedAt,
  } as any;
}

describe("isFreshPriceSnapshot", () => {
  it("returns false for null snapshot", () => {
    expect(isFreshPriceSnapshot(null)).toBe(false);
  });

  it("returns false for undefined snapshot", () => {
    expect(isFreshPriceSnapshot(undefined)).toBe(false);
  });

  it("returns false for NaN fetchedAt", () => {
    expect(isFreshPriceSnapshot(snapshotWith(NaN))).toBe(false);
  });

  it("returns false for Infinity fetchedAt", () => {
    expect(isFreshPriceSnapshot(snapshotWith(Infinity))).toBe(false);
  });

  it("returns false for -Infinity fetchedAt", () => {
    expect(isFreshPriceSnapshot(snapshotWith(-Infinity))).toBe(false);
  });

  it("returns true for a fresh snapshot (now - 1s)", () => {
    const now = Date.now();
    expect(isFreshPriceSnapshot(snapshotWith(now - 1000), now)).toBe(true);
  });

  it("returns false exactly at the TTL boundary", () => {
    const now = Date.now();
    expect(
      isFreshPriceSnapshot(snapshotWith(now - PRICE_SNAPSHOT_TTL_MS), now),
    ).toBe(false);
  });

  it("returns false just over the TTL boundary", () => {
    const now = Date.now();
    expect(
      isFreshPriceSnapshot(snapshotWith(now - PRICE_SNAPSHOT_TTL_MS - 1), now),
    ).toBe(false);
  });

  it("returns false for a stale snapshot (2x TTL)", () => {
    const now = Date.now();
    expect(
      isFreshPriceSnapshot(snapshotWith(now - 2 * PRICE_SNAPSHOT_TTL_MS), now),
    ).toBe(false);
  });

  it("returns true for a slightly future-dated snapshot (clock skew)", () => {
    const now = Date.now();
    expect(isFreshPriceSnapshot(snapshotWith(now + 1000), now)).toBe(true);
  });

  it("respects a custom now param instead of the wall clock", () => {
    const customNow = 1_000_000_000;
    expect(
      isFreshPriceSnapshot(snapshotWith(customNow - 1000), customNow),
    ).toBe(true);
    expect(
      isFreshPriceSnapshot(
        snapshotWith(customNow - 2 * PRICE_SNAPSHOT_TTL_MS),
        customNow,
      ),
    ).toBe(false);
  });

  it("ignores the wall clock when a custom now is given", () => {
    const wallClockFresh = snapshotWith(Date.now() - 1000);
    const farFutureNow = Date.now() + 10 * PRICE_SNAPSHOT_TTL_MS;
    expect(isFreshPriceSnapshot(wallClockFresh, farFutureNow)).toBe(false);
  });
});

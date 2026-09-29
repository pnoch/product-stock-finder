import { describe, expect, it } from "vitest";
import { appendPricePoint, mergePriceHistory } from "../lib/price-history";
import { getBestPrice, roundMoney } from "../lib/currency";
import type { PricePoint } from "../lib/types";

function point(date: string, price = 100): PricePoint {
  return { date, price, currency: "USD", stockStatus: "in_stock" };
}

describe("appendPricePoint ordering", () => {
  it("keeps history sorted when an out-of-order point arrives", () => {
    const history = [point("2026-03-01T00:00:00.000Z"), point("2026-03-03T00:00:00.000Z")];
    const result = appendPricePoint(
      history,
      point("2026-02-28T00:00:00.000Z"),
      365,
      "2026-03-04T00:00:00.000Z",
    );
    expect(result.map((p) => p.date.slice(0, 10))).toEqual([
      "2026-02-28",
      "2026-03-01",
      "2026-03-03",
    ]);
  });

  it("drops the oldest (not positional) points at the cap", () => {
    const history = Array.from({ length: 500 }, (_, i) =>
      point(
        new Date(Date.UTC(2026, 0, 1) + i * 86_400_000).toISOString(),
      ),
    );
    // Insert an older point: the cap must drop the oldest, keeping 500.
    const result = appendPricePoint(
      history,
      point("2025-12-31T00:00:00.000Z"),
      3650,
      "2026-06-01T00:00:00.000Z",
    );
    expect(result.length).toBe(500);
    // The oldest point (2025-12-31) is dropped, so the window starts 2026-01-01.
    expect(result[0]!.date.slice(0, 10)).toBe("2026-01-01");
    // 500 points from 2026-01-01 inclusive ends 2027-05-15.
    expect(result[result.length - 1]!.date.slice(0, 10)).toBe("2027-05-15");
  });
});

describe("same-day point selection across ISO formats", () => {
  // `"…T00:00:00Z" > "…T00:00:00.500Z"` lexically, but the .500Z point is
  // chronologically later. A hand-edited backup or a legacy export can mix the
  // two forms, so the winner must be chosen by parsed time, not string order.
  const noMillis = point("2026-01-01T00:00:00Z", 100);
  const withMillis = point("2026-01-01T00:00:00.500Z", 200);
  const now = "2026-06-01T00:00:00.000Z";

  it("appendPricePoint keeps the chronologically newer same-day point", () => {
    expect(appendPricePoint([noMillis], withMillis, 3650, now)[0]!.price).toBe(200);
    // And the reverse: an older incoming point must not overwrite the newer one.
    expect(appendPricePoint([withMillis], noMillis, 3650, now)[0]!.price).toBe(200);
  });

  it("mergePriceHistory keeps the chronologically newer same-day point", () => {
    expect(mergePriceHistory([noMillis], [withMillis], 3650, now)[0]!.price).toBe(200);
    expect(mergePriceHistory([withMillis], [noMillis], 3650, now)[0]!.price).toBe(200);
  });
});

describe("roundMoney", () => {
  it("rounds to 2 decimals", () => {
    expect(roundMoney(1.006)).toBe(1.01);
    expect(roundMoney(1.004)).toBe(1);
    expect(roundMoney(1299.999)).toBe(1300);
  });
});

describe("getBestPrice rounding", () => {
  it("returns a 2-decimal price", () => {
    const best = getBestPrice(
      [{ price: 10.333, currency: "USD", stockStatus: "in_stock" }],
      "USD",
    );
    expect(best?.price).toBe(10.33);
  });
});

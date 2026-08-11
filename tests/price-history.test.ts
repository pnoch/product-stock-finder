import { describe, expect, it } from "vitest";
import { appendPricePoint } from "../lib/price-history";
import type { PricePoint } from "../lib/types";

function point(
  date: string,
  price: number,
  stockStatus: string = "in_stock",
): PricePoint {
  return { date, price, currency: "USD", stockStatus };
}

describe("appendPricePoint", () => {
  const NOW = "2026-08-11T12:00:00.000Z";

  it("appends a new-day point in chronological order", () => {
    const history = [point("2026-08-10T09:00:00.000Z", 100)];
    const result = appendPricePoint(
      history,
      point("2026-08-11T09:00:00.000Z", 105),
      90,
      NOW,
    );
    expect(result.map((p) => p.date.slice(0, 10))).toEqual([
      "2026-08-10",
      "2026-08-11",
    ]);
    expect(result[1].price).toBe(105);
  });

  it("replaces a point on the same UTC day", () => {
    const history = [point("2026-08-11T08:00:00.000Z", 100)];
    const result = appendPricePoint(
      history,
      point("2026-08-11T20:00:00.000Z", 108),
      90,
      NOW,
    );
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(108);
    expect(result[0].date).toBe("2026-08-11T20:00:00.000Z");
  });

  it("preserves the latest stockStatus on same-day replacement", () => {
    const history = [point("2026-08-11T08:00:00.000Z", 100, "back_order")];
    const result = appendPricePoint(
      history,
      point("2026-08-11T20:00:00.000Z", 100, "in_stock"),
      90,
      NOW,
    );
    expect(result[0].stockStatus).toBe("in_stock");
  });

  it("prunes points older than maxDays", () => {
    const history = [
      point("2026-05-10T09:00:00.000Z", 90),
      point("2026-06-01T09:00:00.000Z", 95),
    ];
    const result = appendPricePoint(
      history,
      point("2026-08-11T09:00:00.000Z", 105),
      90,
      NOW,
    );
    expect(result.map((p) => p.date.slice(0, 10))).toEqual([
      "2026-06-01",
      "2026-08-11",
    ]);
  });

  it("keeps a point exactly maxDays old (inclusive boundary)", () => {
    const exactly = "2026-05-13T09:00:00.000Z"; // 90 days before NOW
    const result = appendPricePoint(
      [point(exactly, 100)],
      point("2026-08-11T09:00:00.000Z", 105),
      90,
      NOW,
    );
    expect(result).toHaveLength(2);
  });

  it("returns a single-point history when history is empty", () => {
    const result = appendPricePoint(
      [],
      point("2026-08-11T09:00:00.000Z", 105),
      90,
      NOW,
    );
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(105);
  });
});

import { describe, expect, it } from "vitest";
import { appendPricePoint, mergePriceHistory } from "../lib/price-history";
import type { PricePoint, StockStatus } from "../lib/types";

function point(
  date: string,
  price: number,
  stockStatus: StockStatus = "in_stock",
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
    const exactly = "2026-05-13T12:00:00.000Z"; // 90 days before NOW
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

describe("appendPricePoint", () => {
  it("tolerates a missing history array", () => {
    // The device-scrape branch of refreshListing passed listing.priceHistory
    // unguarded; the throw was swallowed and the scraped price discarded.
    const incoming = point("2026-08-11T09:00:00.000Z", 100);
    expect(
      appendPricePoint(undefined as unknown as PricePoint[], incoming),
    ).toEqual([incoming]);
  });
});

describe("mergePriceHistory", () => {
  it("tolerates a missing local history array", () => {
    // A listing restored without priceHistory (partial backup/sync payload)
    // reached this helper and threw, aborting the whole refresh run.
    const server = [point("2026-08-11T09:00:00.000Z", 105)];
    expect(
      mergePriceHistory(undefined as unknown as PricePoint[], server),
    ).toEqual(server);
    expect(
      mergePriceHistory(server, undefined as unknown as PricePoint[]),
    ).toEqual(server);
  });

  const NOW = "2026-08-11T12:00:00.000Z";

  it("keeps the newer point for the same day (server copy is later)", () => {
    // The sync path merges the server's history over the local one; a same-day
    // pair must resolve to the later instant, not the first seen.
    const local = [point("2026-08-11T08:00:00.000Z", 100)];
    const server = [point("2026-08-11T20:00:00.000Z", 108)];
    const merged = mergePriceHistory(local, server, 365, NOW);
    expect(merged).toHaveLength(1);
    expect(merged[0].price).toBe(108);
    expect(merged[0].date).toBe("2026-08-11T20:00:00.000Z");
  });

  it("keeps the newer point for the same day (local copy is later)", () => {
    const local = [point("2026-08-11T20:00:00.000Z", 108)];
    const server = [point("2026-08-11T08:00:00.000Z", 100)];
    const merged = mergePriceHistory(local, server, 365, NOW);
    expect(merged).toHaveLength(1);
    expect(merged[0].price).toBe(108);
  });

  it("drops invalid dates and prunes points outside the window", () => {
    const invalid = { date: "not-a-date", price: 1, currency: "USD", stockStatus: "in_stock" } as PricePoint;
    const merged = mergePriceHistory(
      [point("2026-08-11T08:00:00.000Z", 100), invalid],
      [point("2026-01-01T00:00:00.000Z", 50)],
      30,
      NOW,
    );
    expect(merged.map((p) => p.date)).toEqual(["2026-08-11T08:00:00.000Z"]);
  });
});

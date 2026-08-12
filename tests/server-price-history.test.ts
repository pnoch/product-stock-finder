import { describe, expect, it, beforeEach } from "vitest";
import {
  recordHistoryPoint,
  getHistory,
  mergeHistory,
  purgeOldHistory,
  clearHistoryForTests,
} from "../server/price-history";
import type { PriceSnapshot, PricePoint } from "../lib/types";

function snapshot(overrides: Partial<PriceSnapshot> = {}): PriceSnapshot {
  return {
    price: 99.5,
    currency: "USD",
    stockStatus: "in_stock",
    url: "https://example.com/p",
    fetchedAt: 1000,
    ...overrides,
  };
}

function point(overrides: Partial<PricePoint> = {}): PricePoint {
  return {
    date: "2026-08-01T00:00:00.000Z",
    price: 99.5,
    currency: "USD",
    stockStatus: "in_stock",
    ...overrides,
  };
}

describe("price history (memory backend)", () => {
  beforeEach(() => clearHistoryForTests());

  it("returns an empty history for an unknown key", async () => {
    expect(await getHistory("server2u-my", "CRS804")).toEqual([]);
  });

  it("records a point from a snapshot", async () => {
    await recordHistoryPoint(
      "server2u-my",
      "CRS804",
      snapshot({ price: 88.5, fetchedAt: Date.parse("2026-08-01T12:00:00Z") }),
    );
    const history = await getHistory("server2u-my", "CRS804");
    expect(history).toEqual([
      {
        date: "2026-08-01T12:00:00.000Z",
        price: 88.5,
        currency: "USD",
        stockStatus: "in_stock",
      },
    ]);
  });

  it("dedupes two records on the same UTC day", async () => {
    await recordHistoryPoint(
      "server2u-my",
      "CRS804",
      snapshot({ price: 88.5, fetchedAt: Date.parse("2026-08-01T08:00:00Z") }),
    );
    await recordHistoryPoint(
      "server2u-my",
      "CRS804",
      snapshot({ price: 90, fetchedAt: Date.parse("2026-08-01T20:00:00Z") }),
    );
    const history = await getHistory("server2u-my", "CRS804");
    expect(history).toHaveLength(1);
    expect(history[0]!.price).toBe(90);
  });

  it("keeps distinct days and sorts ascending", async () => {
    await recordHistoryPoint(
      "server2u-my",
      "CRS804",
      snapshot({ price: 90, fetchedAt: Date.parse("2026-08-02T00:00:00Z") }),
    );
    await recordHistoryPoint(
      "server2u-my",
      "CRS804",
      snapshot({ price: 88.5, fetchedAt: Date.parse("2026-08-01T00:00:00Z") }),
    );
    const history = await getHistory("server2u-my", "CRS804");
    expect(history.map((p) => p.price)).toEqual([88.5, 90]);
  });

  it("mergeHistory upserts points with newest fetchedAt winning", async () => {
    await mergeHistory("server2u-my", "CRS804", [
      point({ date: "2026-08-01T08:00:00.000Z", price: 100 }),
    ]);
    await mergeHistory("server2u-my", "CRS804", [
      point({ date: "2026-08-01T20:00:00.000Z", price: 95 }),
      point({ date: "2026-08-02T00:00:00.000Z", price: 90 }),
    ]);
    const history = await getHistory("server2u-my", "CRS804");
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({ date: "2026-08-01T20:00:00.000Z", price: 95 });
    expect(history[1]).toMatchObject({ date: "2026-08-02T00:00:00.000Z", price: 90 });
  });

  it("purgeOldHistory removes rows older than 90 days", async () => {
    const now = Date.parse("2026-08-12T00:00:00Z");
    await recordHistoryPoint(
      "server2u-my",
      "CRS804",
      snapshot({ price: 80, fetchedAt: Date.parse("2026-01-01T00:00:00Z") }),
    );
    await recordHistoryPoint(
      "server2u-my",
      "CRS804",
      snapshot({ price: 90, fetchedAt: Date.parse("2026-08-01T00:00:00Z") }),
    );
    await purgeOldHistory(now);
    const history = await getHistory("server2u-my", "CRS804");
    expect(history.map((p) => p.price)).toEqual([90]);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildEvents,
  type HistoryLookup,
  type PriceLookup,
} from "../server/notifications/build-events";
import type { NotificationConfig } from "../server/notifications/types";
import type { PricePoint } from "../lib/types";

const NOW = Date.parse("2026-06-15T12:00:00Z");

type Snapshot = Awaited<ReturnType<PriceLookup>>;

function snapshot(price: number, stockStatus = "in_stock"): Snapshot {
  return {
    price,
    currency: "USD",
    stockStatus,
    fetchedAt: NOW,
  } as unknown as Snapshot;
}

function historyPoint(daysAgo: number, price: number): PricePoint {
  return {
    date: new Date(NOW - daysAgo * 86_400_000).toISOString(),
    price,
    currency: "USD",
    stockStatus: "in_stock",
  };
}

function around100(): PricePoint[] {
  return [historyPoint(5, 98), historyPoint(3, 100), historyPoint(1, 102)];
}

function config(overrides: Partial<NotificationConfig> = {}): NotificationConfig {
  return {
    alerts: [],
    stockWatches: [],
    dateReminders: [],
    ...overrides,
  };
}

function dropAlert() {
  return {
    id: "a1",
    productId: "p1",
    modelNumber: "M1",
    targetPrice: 50,
    currency: "USD",
    distributorId: "server2u-my",
  };
}

const historyOf = (points: PricePoint[]): HistoryLookup => async () => points;

describe("buildEvents price anomaly guard", () => {
  it("skips a misparsed price far below history", async () => {
    const getPrice: PriceLookup = async () => snapshot(3);
    const events = await buildEvents(
      config({ alerts: [dropAlert()] }),
      NOW,
      getPrice,
      historyOf(around100()),
    );
    expect(events.filter((e) => e.type === "price_drop")).toHaveLength(0);
  });

  it("still fires a real drop within normal range", async () => {
    const getPrice: PriceLookup = async () => snapshot(40);
    const events = await buildEvents(
      config({ alerts: [dropAlert()] }),
      NOW,
      getPrice,
      historyOf(around100()),
    );
    expect(events.filter((e) => e.type === "price_drop")).toHaveLength(1);
  });
});

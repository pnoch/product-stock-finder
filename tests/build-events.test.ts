import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildEvents,
  newEventId,
  type PriceLookup,
} from "../server/notifications/build-events";
import type { NotificationConfig } from "../server/notifications/types";

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

function config(overrides: Partial<NotificationConfig> = {}): NotificationConfig {
  return {
    alerts: [],
    stockWatches: [],
    dateReminders: [],
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildEvents", () => {
  it("scopes a drop alert to its configured distributor", async () => {
    const queried: string[] = [];
    const getPrice: PriceLookup = async (distributorId) => {
      queried.push(distributorId);
      return snapshot(80);
    };
    const events = await buildEvents(
      config({
        alerts: [
          {
            id: "a1",
            productId: "p1",
            modelNumber: "M1",
            targetPrice: 100,
            currency: "USD",
            distributorId: "server2u-my",
          },
        ],
      }),
      NOW,
      getPrice,
    );
    expect(queried).toEqual(["server2u-my"]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "price_drop",
      payload: { distributorId: "server2u-my", triggeredPrice: 80 },
    });
  });

  it("skips an alert snoozed into the future", async () => {
    const getPrice = vi.fn(async () => snapshot(80)) as unknown as PriceLookup;
    const events = await buildEvents(
      config({
        alerts: [
          {
            id: "a1",
            productId: "p1",
            modelNumber: "M1",
            targetPrice: 100,
            currency: "USD",
            snoozedUntil: new Date(NOW + 3_600_000).toISOString(),
          },
        ],
      }),
      NOW,
      getPrice,
    );
    expect(events).toEqual([]);
    expect(getPrice).not.toHaveBeenCalled();
  });

  it("skips a rise alert while the price is still below target", async () => {
    const getPrice: PriceLookup = async () => snapshot(80);
    const events = await buildEvents(
      config({
        alerts: [
          {
            id: "a1",
            productId: "p1",
            modelNumber: "M1",
            targetPrice: 100,
            currency: "USD",
            direction: "rise",
          },
        ],
      }),
      NOW,
      getPrice,
    );
    expect(events).toEqual([]);
  });

  it("falls back to the distributor id for an unknown reminder distributor", async () => {
    const events = await buildEvents(
      config({
        dateReminders: [
          {
            id: "r1",
            productId: "p1",
            modelNumber: "M1",
            distributorId: "ghost-distributor",
            reminderDate: new Date(NOW - 1000).toISOString(),
          },
        ],
      }),
      NOW,
      async () => null,
    );
    expect(events).toHaveLength(1);
    expect(events[0]!.body).toContain("ghost-distributor");
  });
});

describe("newEventId", () => {
  it("generates a fallback id when crypto.randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    expect(newEventId()).toMatch(/^evt-[a-z0-9]+-[a-z0-9]+$/);
  });
});

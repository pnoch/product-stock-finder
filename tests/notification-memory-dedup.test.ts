import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/db", () => ({
  getDb: vi.fn(async () => null),
}));

vi.mock("../server/push-notifications", () => ({
  sendPushForDevice: vi.fn(async () => {}),
  sendPushForUser: vi.fn(async () => {}),
}));

import {
  upsertDeviceConfig,
  evaluateNotifications,
  clearNotificationsForTests,
} from "../server/notifications";
import { setCachedPrice, clearPriceCacheForTests } from "../server/price-cache";
import { memoryEvents } from "../server/notifications/memory-store";
import type { NotificationConfig } from "../server/notifications";

// The memory path stores events via draftToEvent, which drops dedupKey. Without
// preserving it, dedupKeyFor falls back to restock:<productId>:<distributorId>,
// so the `restock:<productId>:any` key is never in `blocked` and the any-scope
// watch re-fires on every tick.
describe("memory restock dedup survives the round-trip", () => {
  beforeEach(() => {
    clearNotificationsForTests();
    clearPriceCacheForTests();
    vi.clearAllMocks();
  });

  it("fires the any-scope restock once across repeated ticks", async () => {
    const now = Date.now();
    await setCachedPrice("linitx-uk", "SC1112", {
      price: 100,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: now,
    });
    const config: NotificationConfig = {
      alerts: [],
      stockWatches: [
        {
          id: "w1",
          productId: "raspberry-pi-5-8gb",
          modelNumber: "SC1112",
          distributorId: "*",
          scope: "any",
        },
      ],
      dateReminders: [],
    };
    await upsertDeviceConfig("dev-any", config, null);

    await evaluateNotifications(now);
    // dedupKey preserved as the any key (not the distributor fallback).
    const first = [...memoryEvents.values()];
    expect(first).toHaveLength(1);
    expect(first[0]!.dedupKey).toBe("restock:raspberry-pi-5-8gb:any");

    // Same in-stock condition on a later tick must not create a second event.
    await evaluateNotifications(now + 60_000);
    expect(memoryEvents.size).toBe(1);
  });
});

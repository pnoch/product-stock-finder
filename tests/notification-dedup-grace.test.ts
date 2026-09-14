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
  pullPendingEvents,
  clearNotificationsForTests,
} from "../server/notifications";
import { setCachedPrice, clearPriceCacheForTests } from "../server/price-cache";
import { sendPushForDevice } from "../server/push-notifications";
import type { NotificationConfig } from "../server/notifications";

const baseConfig: NotificationConfig = {
  alerts: [],
  stockWatches: [],
  dateReminders: [],
};

const alert = {
  id: "a1",
  productId: "mikrotik-crs804-4ddq-hrm",
  targetPrice: 500,
  currency: "USD",
};

describe("dedup is not blocked forever by a non-pulling device", () => {
  beforeEach(() => {
    clearNotificationsForTests();
    clearPriceCacheForTests();
    vi.clearAllMocks();
  });

  it("releases the key after the delivery grace period even if a device never pulls", async () => {
    const now = Date.now();
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: now,
    });
    // Two devices bound to the same user; dev-2 never pulls.
    await upsertDeviceConfig("dev-1", { ...baseConfig, alerts: [alert] }, 7);
    await upsertDeviceConfig("dev-2", { ...baseConfig, alerts: [alert] }, 7);

    await evaluateNotifications(now);
    expect(await pullPendingEvents("dev-1", 7)).toHaveLength(1);

    // dev-2 never pulls. Past the 24h cooldown but within the 7d grace, the
    // key stays blocked (dev-2 may still catch up).
    vi.mocked(sendPushForDevice).mockClear();
    await evaluateNotifications(now + 25 * 60 * 60_000);
    expect(await pullPendingEvents("dev-1", 7)).toEqual([]);

    // Past the grace period the abandoned binding no longer suppresses the
    // persisting condition, so a fresh event is created.
    await evaluateNotifications(now + 8 * 24 * 60 * 60_000);
    expect(await pullPendingEvents("dev-1", 7)).toHaveLength(1);
  });

  it("keeps blocking while a bound device is still within the grace period", async () => {
    const now = Date.now();
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: now,
    });
    await upsertDeviceConfig("dev-1", { ...baseConfig, alerts: [alert] }, 7);
    await upsertDeviceConfig("dev-2", { ...baseConfig, alerts: [alert] }, 7);
    await evaluateNotifications(now);
    await pullPendingEvents("dev-1", 7);

    // 6 days later, still inside the grace window: no re-fire.
    await evaluateNotifications(now + 6 * 24 * 60 * 60_000);
    expect(await pullPendingEvents("dev-1", 7)).toEqual([]);
  });
});

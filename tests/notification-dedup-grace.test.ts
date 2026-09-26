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
import {
  digestBuffers,
  memoryDeliveries,
  memoryEvents,
} from "../server/notifications/memory-store";
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

// QA round 84: the per-device evaluation loaded every retained event (30 days)
// on every tick, while isEventBlocking only ever blocks within
// DELIVERY_GRACE_MS (7 days). The read must be bounded like the per-user path.
describe("per-device evaluation bounds its event read", () => {
  it("filters existing events by the delivery grace window", async () => {
    const { readFile } = await import("node:fs/promises");
    const src = await readFile("server/notifications/evaluate.ts", "utf8");
    const start = src.indexOf("async function evaluateConfigDb");
    const block = src.slice(start, src.indexOf("async function evaluateUserDb", start));
    expect(block).toContain("gt(notificationEvents.createdAt, now - DELIVERY_GRACE_MS)");
  });
});

describe("in-memory notification hygiene", () => {
  beforeEach(() => clearNotificationsForTests());

  it("purge drops delivered ids for purged events", async () => {
    const { purgeOldNotificationEvents } = await import(
      "../server/notifications/index"
    );
    memoryEvents.set("e1", {
      id: "e1",
      type: "price_drop",
      title: "t",
      body: "b",
      createdAt: 1_000,
      deviceId: "dev-1",
      userId: null,
    } as never);
    memoryDeliveries.set("dev-1", new Set(["e1"]));
    // Far past any retention window (the constant is module-private).
    await purgeOldNotificationEvents(Date.now() + 10 * 365 * 86_400_000);
    expect(memoryEvents.has("e1")).toBe(false);
    // The DB path cascades deliveries with the event row.
    expect(memoryDeliveries.size).toBe(0);
  });

  it("removing a device drops its held quiet-hours buffer", async () => {
    const { removeMemoryDevice } = await import("../server/notifications/memory-store");
    digestBuffers.set(
      "d:dev-1",
      new Map([["k", { type: "digest", title: "t", body: "b", createdAt: 1 } as never]]),
    );
    removeMemoryDevice("dev-1");
    expect(digestBuffers.has("d:dev-1")).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb, upsertUser } from "../server/db";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

vi.mock("../server/push-notifications", () => ({
  upsertPushToken: vi.fn(),
  sendPushForDevice: vi.fn(),
  sendPushForUser: vi.fn(),
  clearPushTokensForTests: vi.fn(),
}));

vi.mock("../server/email", () => ({
  isEmailConfigured: () => false,
  sendEmail: vi.fn(async () => false),
}));

import {
  clearNotificationsForTests,
  evaluateNotifications,
  pullPendingEvents,
  upsertDeviceConfig,
  type NotificationConfig,
} from "../server/notifications";
import { setCachedPrice } from "../server/price-cache";

function hhmm(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

function windowAround(now: number, beforeMin: number, afterMin: number) {
  return { start: hhmm(now - beforeMin * 60000), end: hhmm(now + afterMin * 60000) };
}

const baseConfig: NotificationConfig = {
  alerts: [],
  stockWatches: [],
  dateReminders: [],
};

function heldConfig(now: number): NotificationConfig {
  return {
    ...baseConfig,
    alerts: [
      {
        id: "a1",
        productId: "mikrotik-crs804-4ddq-hrm",
        targetPrice: 500,
        currency: "USD",
      },
    ],
    quietHours: windowAround(now, 30, 30),
  };
}

describe.skipIf(!runDbTests)("server digest (DB hold-and-flush)", () => {
  let userId: number;

  beforeEach(async () => {
    const db = await getDb();
    if (!db) return;
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    for (const table of [
      "notification_event_deliveries",
      "notification_events",
      "device_notification_configs",
      "price_cache",
      "users",
    ]) {
      await db.execute(sql.raw(`TRUNCATE TABLE ${table}`));
    }
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
    clearNotificationsForTests();
    await upsertUser({ openId: "digest-user", email: "d@x.com" });
    userId = (
      await db.select({ id: users.id }).from(users)
    )[0]!.id;
  });

  async function seed(now: number, deviceId: string, boundUserId: number | null) {
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: now,
    });
    await upsertDeviceConfig(deviceId, heldConfig(now), boundUserId);
  }

  it("holds then flushes one digest for an anonymous device (evaluateConfigDb)", async () => {
    const now = Date.now();
    await seed(now, "dev-anon", null);
    await evaluateNotifications(now);
    expect(await pullPendingEvents("dev-anon")).toEqual([]);

    await evaluateNotifications(now + 3_600_000);
    const events = await pullPendingEvents("dev-anon");
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("digest");
    expect(events[0]!.body).toContain("480");
  });

  it("holds then flushes one digest for a user-bound device (evaluateUserDb)", async () => {
    const now = Date.now();
    await seed(now, "dev-user", userId);
    await evaluateNotifications(now);
    expect(await pullPendingEvents("dev-user", userId)).toEqual([]);

    await evaluateNotifications(now + 3_600_000);
    const events = await pullPendingEvents("dev-user", userId);
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe("digest");
    expect(events[0]!.body).toContain("480");
  });
});

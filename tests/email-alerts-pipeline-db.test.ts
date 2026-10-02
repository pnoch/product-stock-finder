import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appSettings, notificationEmailLog, users } from "../drizzle/schema";
import { getDb, upsertUser } from "../server/db";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;
process.env.EXPO_PUBLIC_WEB_URL = "https://app.example.com";

const sent = vi.hoisted(() => ({ n: 0 }));
vi.mock("../server/email", () => ({
  isEmailConfigured: () => true,
  sendEmail: vi.fn(async () => {
    sent.n += 1;
    return true;
  }),
}));

import {
  clearNotificationsForTests,
  evaluateNotifications,
  upsertDeviceConfig,
  type NotificationConfig,
} from "../server/notifications";
import { clearPriceCacheForTests, setCachedPrice } from "../server/price-cache";

describe.skipIf(!runDbTests)("email alert pipeline (DB)", () => {
  let userId: number;
  beforeEach(async () => {
    const db = await getDb();
    await db!.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    for (const t of [
      "notification_event_deliveries",
      "notification_events",
      "notification_email_log",
      "device_notification_configs",
      "price_cache",
      "app_settings",
      "users",
    ]) {
      await db!.execute(sql.raw(`TRUNCATE TABLE ${t}`));
    }
    await db!.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
    clearNotificationsForTests();
    clearPriceCacheForTests();
    sent.n = 0;
    await upsertUser({ openId: "pipe-user", email: "p@example.com" });
    userId = (await db!.select({ id: users.id }).from(users))[0]!.id;
    await db!.insert(appSettings).values({
      userId,
      data: { emailAlerts: true },
      updatedAtMs: Date.now(),
      clientUpdatedAtMs: Date.now(),
    });
  });

  afterEach(() => vi.clearAllMocks());

  it("emails once for an alert and not again on the next tick", async () => {
    const now = Date.now();
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 400, currency: "USD", stockStatus: "in_stock",
      url: "https://example.com", fetchedAt: now,
    });
    const config: NotificationConfig = {
      alerts: [{ id: "a1", productId: "mikrotik-crs804-4ddq-hrm", targetPrice: 500, currency: "USD" }],
      stockWatches: [],
      dateReminders: [],
    };
    await upsertDeviceConfig("dev-pipe", config, userId);
    await evaluateNotifications(now);
    await evaluateNotifications(now + 60_000);
    // Delivery is fire-and-forget off the event insert; wait for it.
    await vi.waitFor(() => expect(sent.n).toBe(1), { timeout: 10_000 });
    const rows = await (await getDb())!
      .select({ dedupKey: notificationEmailLog.dedupKey })
      .from(notificationEmailLog);
    expect(rows).toHaveLength(1);
  });

  it("holds the daily cap under a burst of simultaneous alerts", async () => {
    const now = Date.now();
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 400, currency: "USD", stockStatus: "in_stock",
      url: "https://example.com", fetchedAt: now,
    });
    // 25 distinct alert ids → 25 distinct dedupKeys, all satisfied by the same
    // cached price. Without serialization every delivery reads `count < 20`
    // before any claim commits and all 25 send.
    const config: NotificationConfig = {
      alerts: Array.from({ length: 25 }, (_, i) => ({
        id: `burst-${i}`,
        productId: "mikrotik-crs804-4ddq-hrm",
        targetPrice: 500,
        currency: "USD",
      })),
      stockWatches: [],
      dateReminders: [],
    };
    await upsertDeviceConfig("dev-burst", config, userId);
    await evaluateNotifications(now);
    await vi.waitFor(() => expect(sent.n).toBeGreaterThan(0), {
      timeout: 10_000,
    });
    // Allow the serialized chain to drain, then assert the cap held.
    await new Promise((r) => setTimeout(r, 200));
    expect(sent.n).toBe(20);
  });
});

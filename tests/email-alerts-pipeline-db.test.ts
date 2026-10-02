import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appSettings, users } from "../drizzle/schema";
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
    await vi.waitFor(() => expect(sent.n).toBe(1), { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 50));
    expect(sent.n).toBe(1);
  });
});

import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  deviceNotificationConfigs,
  notificationEvents,
  users,
} from "../drizzle/schema";
import { getDb } from "../server/db";
import { clearPriceCacheForTests, setCachedPrice } from "../server/price-cache";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

import { evaluateNotifications } from "../server/notifications";

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

// The in-memory store re-keys by unique event id, so it re-fires correctly; the
// DB path's unique (deviceId, dedupKey) index is what used to suppress the
// re-fire forever (the no-op upsert never refreshed createdAt).
describe.skipIf(!runDbTests)("notification re-fire (DB)", () => {
  const deviceId = "refire-device";
  let userId: number;

  beforeEach(async () => {
    clearPriceCacheForTests();
    const db = await getDb();
    if (!db) return;
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    for (const table of [
      "notification_events",
      "notification_event_deliveries",
      "device_notification_configs",
      "users",
    ]) {
      await db.execute(sql.raw(`TRUNCATE TABLE ${table}`));
    }
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
    await db.insert(users).values({ openId: "refire-user" });
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.openId, "refire-user"));
    userId = row!.id;
    await db.insert(deviceNotificationConfigs).values({
      deviceId,
      userId,
      alerts: [
        {
          id: "a1",
          productId: "mikrotik-crs804-4ddq-hrm",
          targetPrice: 500,
          currency: "USD",
        },
      ],
      stockWatches: [],
      dateReminders: [],
      quietHours: null,
      updatedAt: Date.now(),
    });
    const now = Date.now();
    await setCachedPrice("server2u-my", "CRS804-4DDQ-hRM", {
      price: 480,
      currency: "USD",
      stockStatus: "in_stock",
      url: "https://example.com",
      fetchedAt: now,
    });
  });

  it("re-notifies a released condition with a fresh event id", async () => {
    const db = await getDb();
    // The config carries a userId, so events are user-scoped (deviceId null).
    const rowsFor = () =>
      db!
        .select()
        .from(notificationEvents)
        .where(eq(notificationEvents.userId, userId));

    const t0 = Date.now();
    await evaluateNotifications(t0);
    const first = await rowsFor();
    expect(first).toHaveLength(1);

    // Under the cooldown the persisting condition must stay quiet.
    await evaluateNotifications(t0 + HOUR);
    // Past the cooldown but inside the delivery grace an undelivered event still
    // blocks (a device may yet pull it) — same rule as the in-memory path.
    await evaluateNotifications(t0 + 25 * HOUR);
    const quiet = await rowsFor();
    expect(quiet).toHaveLength(1);
    expect(quiet[0]!.id).toBe(first[0]!.id);

    // Past the cooldown it must notify again: a fresh id (the client pull
    // dedupes by id) with the cooldown re-armed from now.
    const t2 = t0 + 8 * DAY;
    await evaluateNotifications(t2);
    const after = await rowsFor();
    expect(after).toHaveLength(1);
    expect(after[0]!.id).not.toBe(first[0]!.id);
    expect(after[0]!.createdAt).toBe(t2);

    // And the re-armed cooldown holds for the next window.
    await evaluateNotifications(t2 + HOUR);
    const again = await rowsFor();
    expect(again).toHaveLength(1);
    expect(again[0]!.id).toBe(after[0]!.id);
  });
});

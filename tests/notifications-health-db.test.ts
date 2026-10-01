import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { notificationEvents, users } from "../drizzle/schema";
import { getDb, upsertUser } from "../server/db";
import {
  pullPendingEvents,
  purgeOldNotificationEvents,
  upsertDeviceConfig,
  type NotificationConfig,
} from "../server/notifications";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

const DAY = 24 * 60 * 60 * 1000;

function config(
  healthEvents: NonNullable<NotificationConfig["healthEvents"]>,
): NotificationConfig {
  return { alerts: [], stockWatches: [], dateReminders: [], healthEvents };
}

function healthEvent(id: string, kind: "alert" | "recovery" = "alert") {
  return {
    id,
    distributorId: "server2u-my",
    distributorName: "Server2U",
    status: kind === "recovery" ? ("error" as const) : ("blocked" as const),
    kind,
    title: `T-${id}`,
    body: `B-${id}`,
    createdAt: Date.now(),
  };
}

async function countEvents(userId: number | null): Promise<number> {
  const db = await getDb();
  const rows = await db!
    .select({ id: notificationEvents.id })
    .from(notificationEvents)
    .where(
      userId === null
        ? sql`${notificationEvents.userId} IS NULL`
        : eq(notificationEvents.userId, userId),
    );
  return rows.length;
}

describe.skipIf(!runDbTests)("notification health events (DB)", () => {
  let userId: number;

  beforeEach(async () => {
    const db = await getDb();
    if (!db) return;
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    for (const table of [
      "notification_event_deliveries",
      "notification_events",
      "device_notification_configs",
      "users",
    ]) {
      await db.execute(sql.raw(`TRUNCATE TABLE ${table}`));
    }
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
    await upsertUser({ openId: "notif-user", email: "n@x.com" });
    const row = (
      await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.openId, "notif-user"))
    )[0]!;
    userId = row.id;
  });

  it("stores health events for a bound device and dedupes repeats", async () => {
    await upsertDeviceConfig("dev-h", config([healthEvent("h1")]), userId);
    expect(await countEvents(userId)).toBe(1);

    // Same alert again must dedupe; a recovery carries a distinct key.
    await upsertDeviceConfig(
      "dev-h",
      config([healthEvent("h1"), healthEvent("h1-recovery", "recovery")]),
      userId,
    );
    expect(await countEvents(userId)).toBe(2);

    const pending = await pullPendingEvents("dev-h", userId);
    expect(pending.map((e) => e.type)).toEqual(["health", "health"]);
    expect(pending.map((e) => e.id)).toEqual(["h1", "h1-recovery"]);
    // Once pulled they are marked delivered.
    expect(await pullPendingEvents("dev-h", userId)).toEqual([]);
  });

  it("drops health events when no user is bound to the device", async () => {
    await upsertDeviceConfig("dev-anon", config([healthEvent("h2")]), null);
    expect(await countEvents(null)).toBe(0);
  });

  it("purges events past the 30-day retention, keeping fresh ones", async () => {
    const db = await getDb();
    const now = Date.now();
    await db!.insert(notificationEvents).values([
      {
        id: "old",
        type: "health",
        dedupKey: "old-key",
        title: "old",
        body: "old",
        createdAt: now - 40 * DAY,
      },
      {
        id: "fresh",
        type: "health",
        dedupKey: "fresh-key",
        title: "fresh",
        body: "fresh",
        createdAt: now - DAY,
      },
    ]);

    await purgeOldNotificationEvents(now);

    const ids = (
      await db!.select({ id: notificationEvents.id }).from(notificationEvents)
    ).map((r) => r.id);
    expect(ids).toEqual(["fresh"]);
  });
});

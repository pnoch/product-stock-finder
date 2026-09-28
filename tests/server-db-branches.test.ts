import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deviceNotificationConfigs,
  sharedWatchlists,
  trendingProducts,
  users,
} from "../drizzle/schema";
import { getDb, updateUserPasswordHashById } from "../server/db";
import { upsertDeviceConfig } from "../server/notifications";
import { appRouter } from "../server/routers";
import type { TrpcContext } from "../server/_core/context";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

function context(userId: number, role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: { id: userId, openId: `open-${userId}`, role } as TrpcContext["user"],
    req: { headers: {} } as unknown as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
    deviceId: null,
  };
}

describe.skipIf(!runDbTests)("DB-only branches", () => {
  beforeEach(async () => {
    const db = await getDb();
    if (!db) return;
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    for (const table of [
      "device_notification_configs",
      "shared_watchlist_members",
      "shared_watchlists",
      "trendingProducts",
      "users",
    ]) {
      await db.execute(sql.raw(`TRUNCATE TABLE ${table}`));
    }
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
  });

  it("an explicit null clears quiet hours (absent preserves them)", async () => {
    const db = await getDb();
    const quiet = { start: "22:00", end: "07:00", utcOffsetMinutes: 0 };
    await upsertDeviceConfig("dev-q", {
      alerts: [],
      stockWatches: [],
      dateReminders: [],
      quietHours: quiet,
    });
    const rowsFor = () =>
      db!
        .select({ quietHours: deviceNotificationConfigs.quietHours })
        .from(deviceNotificationConfigs)
        .where(eq(deviceNotificationConfigs.deviceId, "dev-q"));
    expect((await rowsFor())[0]!.quietHours).toMatchObject(quiet);

    // An older client that never uploads the field must not wipe it.
    await upsertDeviceConfig("dev-q", {
      alerts: [],
      stockWatches: [],
      dateReminders: [],
    });
    expect((await rowsFor())[0]!.quietHours).toMatchObject(quiet);

    // Disabling quiet hours clears it (previously it stayed batched forever).
    await upsertDeviceConfig("dev-q", {
      alerts: [],
      stockWatches: [],
      dateReminders: [],
      quietHours: null,
    });
    expect((await rowsFor())[0]!.quietHours).toBeNull();
  });

  it("the uploadConfig route accepts an explicit null to clear quiet hours", async () => {
    // Without `nullable()` in the schema the client's explicit null was
    // rejected, so a user who disabled quiet hours stayed batched forever.
    const db = await getDb();
    await db!.insert(users).values({ openId: "quiet-user" });
    const [user] = await db!
      .select({ id: users.id })
      .from(users)
      .where(eq(users.openId, "quiet-user"));
    const caller = appRouter.createCaller({
      ...context(user!.id),
      deviceId: "quiet-device",
    });
    await expect(
      caller.notifications.uploadConfig({
        alerts: [],
        stockWatches: [],
        dateReminders: [],
        quietHours: { start: "22:00", end: "07:00", utcOffsetMinutes: 0 },
      }),
    ).resolves.toEqual({ accepted: true });
    await expect(
      caller.notifications.uploadConfig({
        alerts: [],
        stockWatches: [],
        dateReminders: [],
        quietHours: null,
      }),
    ).resolves.toEqual({ accepted: true });
    const [row] = await db!
      .select({ quietHours: deviceNotificationConfigs.quietHours })
      .from(deviceNotificationConfigs)
      .where(eq(deviceNotificationConfigs.deviceId, "quiet-device"));
    expect(row!.quietHours).toBeNull();
  });

  it("inviting an unknown user reports NOT_FOUND, not a 500", async () => {
    const db = await getDb();
    await db!.insert(users).values({ openId: "owner-invite" });
    const [owner] = await db!
      .select({ id: users.id })
      .from(users)
      .where(eq(users.openId, "owner-invite"));
    await db!.insert(sharedWatchlists).values({
      ownerId: owner!.id,
      token: "tok-invite",
      title: "List",
      expiresAt: null,
    });
    const caller = appRouter.createCaller(context(owner!.id));
    await expect(
      caller.sharedWatchlists.invite({ token: "tok-invite", userId: 99999999 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("a zero-row trending refresh keeps the existing rows", async () => {
    const db = await getDb();
    const now = Date.now();
    await db!.insert(trendingProducts).values({
      id: "trending-existing",
      name: "Existing",
      brand: "Test",
      category: "GPUs",
      estimatedPrice: "100.00",
      currency: "USD",
      reason: "seeded",
      source: "test",
      fetchedAt: new Date(now),
      expiresAt: new Date(now + 3_600_000),
    });
    // RSS feeds parse fine; the model returns an empty list.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        const url = String(input);
        if (url.includes("openai")) {
          return {
            ok: true,
            // readCapped reads the body as text (to bound its size), then parses.
            json: async () => ({
              choices: [{ message: { content: "[]" } }],
            }),
            text: async (): Promise<string> =>
              JSON.stringify({ choices: [{ message: { content: "[]" } }] }),
          };
        }
        return {
          ok: true,
          text: async (): Promise<string> =>
            `<?xml version="1.0"?><rss><channel><item><title>RTX 5090 — $2000</title><link>https://example.com</link></item></channel></rss>`,
        };
      }),
    );
    const caller = appRouter.createCaller(context(1, "admin"));
    const result = await caller.trending.refresh();
    expect(result.count).toBe(0);
    const rows = await db!.select().from(trendingProducts);
    expect(rows).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it("a password change advances credentialsChangedAt so old sessions are invalidated", async () => {
    const db = await getDb();
    await db!.insert(users).values({ openId: "epoch-user" });
    const [user] = await db!
      .select({ id: users.id, epoch: users.credentialsChangedAt })
      .from(users)
      .where(eq(users.openId, "epoch-user"));
    expect(Number(user!.epoch)).toBe(0);

    const epoch = await updateUserPasswordHashById(user!.id, "new-hash");
    expect(epoch).toBeGreaterThan(0);

    const [after] = await db!
      .select({ epoch: users.credentialsChangedAt })
      .from(users)
      .where(eq(users.id, user!.id));
    expect(Number(after!.epoch)).toBe(epoch);
  });
});

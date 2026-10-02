import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appSettings, notificationEmailLog, users } from "../drizzle/schema";
import { getDb, upsertUser } from "../server/db";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

const sent = vi.hoisted(() => ({ messages: [] as { to: string; subject: string }[] }));
vi.mock("../server/email", () => ({
  isEmailConfigured: () => true,
  sendEmail: vi.fn(async (m: { to: string; subject: string }) => {
    sent.messages.push(m);
    return true;
  }),
}));
import {
  deliverEmailForEvent,
  purgeOldEmailLog,
  unsubscribeUser,
} from "../server/notifications/email-alerts";

const ORIGIN = "https://app.example.com";
process.env.EXPO_PUBLIC_WEB_URL = ORIGIN;

async function setEmailAlerts(userId: number, enabled: boolean) {
  const db = await getDb();
  await db!.insert(appSettings).values({
    userId,
    data: { emailAlerts: enabled },
    updatedAtMs: Date.now(),
    clientUpdatedAtMs: Date.now(),
  }).onDuplicateKeyUpdate({
    set: { data: { emailAlerts: enabled }, updatedAtMs: Date.now(), clientUpdatedAtMs: Date.now() },
  });
}

describe.skipIf(!runDbTests)("email alerts delivery (DB)", () => {
  let userId: number;

  beforeEach(async () => {
    const db = await getDb();
    await db!.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    for (const t of ["notification_email_log", "app_settings", "users"]) {
      await db!.execute(sql.raw(`TRUNCATE TABLE ${t}`));
    }
    await db!.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
    sent.messages.length = 0;
    await upsertUser({ openId: "email-user", email: "u@example.com" });
    userId = (await db!.select({ id: users.id }).from(users))[0]!.id;
    await setEmailAlerts(userId, true);
  });

  afterEach(() => vi.clearAllMocks());

  it("sends once per condition and ignores reinserts with the same dedupKey", async () => {
    await deliverEmailForEvent(userId, { dedupKey: "k1", title: "Drop", body: "b", productId: null });
    await deliverEmailForEvent(userId, { dedupKey: "k1", title: "Drop", body: "b", productId: null });
    expect(sent.messages).toHaveLength(1);
    expect(sent.messages[0]!.to).toBe("u@example.com");
  });

  it("does not send when the user has not opted in", async () => {
    await setEmailAlerts(userId, false);
    await deliverEmailForEvent(userId, { dedupKey: "k2", title: "T", body: "b", productId: null });
    expect(sent.messages).toHaveLength(0);
  });

  it("enforces a per-user daily cap", async () => {
    for (let i = 0; i < 25; i++) {
      await deliverEmailForEvent(userId, { dedupKey: `cap-${i}`, title: "T", body: "b", productId: null });
    }
    expect(sent.messages).toHaveLength(20);
  });

  it("unsubscribe flips the flag so later events are skipped", async () => {
    const before = await deliverEmailForEvent(userId, { dedupKey: "u0", title: "T", body: "b", productId: null });
    expect(before).toBe(true);
    await unsubscribeUser(userId);
    const after = await deliverEmailForEvent(userId, { dedupKey: "u1", title: "T", body: "b", productId: null });
    expect(after).toBe(false);
  });

  it("keeps a failed send claimed so it counts toward the cap and is not retried", async () => {
    const email = await import("../server/email");
    vi.mocked(email.sendEmail).mockResolvedValueOnce(false);
    expect(await deliverEmailForEvent(userId, { dedupKey: "fail-1", title: "T", body: "b", productId: null })).toBe(false);
    // Second call short-circuits on the kept claim row (no second send attempt).
    expect(await deliverEmailForEvent(userId, { dedupKey: "fail-1", title: "T", body: "b", productId: null })).toBe(false);
    expect(vi.mocked(email.sendEmail)).toHaveBeenCalledTimes(1);
  });

  it("purges email-log rows older than 30 days", async () => {
    const db = await getDb();
    const now = Date.now();
    await db!.insert(notificationEmailLog).values([
      { userId, dedupKey: "old", sentAt: now - 40 * 24 * 60 * 60 * 1000 },
      { userId, dedupKey: "fresh", sentAt: now },
    ]);
    await purgeOldEmailLog(now);
    const rows = await db!.select({ dedupKey: notificationEmailLog.dedupKey }).from(notificationEmailLog);
    expect(rows.map((r) => r.dedupKey)).toEqual(["fresh"]);
  });
});

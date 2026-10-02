import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appSettings, users } from "../drizzle/schema";
import { getDb, upsertUser } from "../server/db";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
vi.stubGlobal("fetch", fetchMock);

import { deliverWebhookForEvent } from "../server/notifications/webhook-alerts";

async function setWebhookConfig(userId: number, enabled: boolean, url: string) {
  const db = await getDb();
  await db!
    .insert(appSettings)
    .values({
      userId,
      data: { webhookAlerts: enabled, alertWebhookUrl: url },
      updatedAtMs: Date.now(),
      clientUpdatedAtMs: Date.now(),
    })
    .onDuplicateKeyUpdate({
      set: {
        data: { webhookAlerts: enabled, alertWebhookUrl: url },
        updatedAtMs: Date.now(),
        clientUpdatedAtMs: Date.now(),
      },
    });
}

const VALID_URL = "https://discord.com/api/webhooks/1/x";

describe.skipIf(!runDbTests)("webhook alerts delivery (DB)", () => {
  let userId: number;

  beforeEach(async () => {
    const db = await getDb();
    await db!.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    for (const t of ["notification_webhook_log", "app_settings", "users"]) {
      await db!.execute(sql.raw(`TRUNCATE TABLE ${t}`));
    }
    await db!.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await upsertUser({ openId: "webhook-user", email: "w@example.com" });
    userId = (await db!.select({ id: users.id }).from(users))[0]!.id;
    await setWebhookConfig(userId, true, VALID_URL);
  });

  afterEach(() => vi.clearAllMocks());

  it("sends once per condition and ignores reinserts with the same dedupKey", async () => {
    const event = { dedupKey: "k1", title: "Drop", body: "b", productId: null };
    await deliverWebhookForEvent(userId, event);
    await deliverWebhookForEvent(userId, event);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not send when the user has not opted in", async () => {
    await setWebhookConfig(userId, false, VALID_URL);
    await deliverWebhookForEvent(userId, { dedupKey: "k2", title: "T", body: "b", productId: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips an unallowlisted URL without claiming the condition", async () => {
    await setWebhookConfig(userId, true, "https://evil.com/x");
    await deliverWebhookForEvent(userId, { dedupKey: "k3", title: "T", body: "b", productId: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("enforces a per-user daily cap", async () => {
    for (let i = 0; i < 25; i++) {
      await deliverWebhookForEvent(userId, { dedupKey: `cap-${i}`, title: "T", body: "b", productId: null });
    }
    expect(fetchMock).toHaveBeenCalledTimes(20);
  });

  it("keeps the claim on a non-2xx so the same condition is not retried", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    const event = { dedupKey: "fail", title: "T", body: "b", productId: null };
    await deliverWebhookForEvent(userId, event);
    await deliverWebhookForEvent(userId, event);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

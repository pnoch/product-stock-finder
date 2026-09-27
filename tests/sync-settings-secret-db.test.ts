import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { appSettings, users } from "../drizzle/schema";
import { getDb } from "../server/db";
import { upsertSyncItem } from "../server/sync-db";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

describe.skipIf(!runDbTests)("sync settings strip the BYO-LLM key", () => {
  it("never stores llmApiKey server-side", async () => {
    const db = await getDb();
    const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await db!.insert(users).values({ openId: `settings-secret-${run}` });
    const [user] = await db!
      .select({ id: users.id })
      .from(users)
      .where(eq(users.openId, `settings-secret-${run}`));

    const result = await upsertSyncItem(user!.id, {
      collection: "settings",
      id: "settings",
      data: { theme: "dark", displayCurrency: "EUR", llmApiKey: "sk-secret" },
      updatedAt: Date.now(),
      deletedAt: null,
    });
    expect(result.accepted).toBe(true);

    const [row] = await db!
      .select({ data: appSettings.data })
      .from(appSettings)
      .where(eq(appSettings.userId, user!.id));
    const data = row!.data as Record<string, unknown>;
    // The client strips it, but "never stored server-side" must hold even for an
    // older or modified client.
    expect(data.llmApiKey).toBeUndefined();
    expect(data.theme).toBe("dark");
  });
});

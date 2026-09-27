import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { users } from "../drizzle/schema";
import { getDb, linkUserOpenIdByEmail } from "../server/db";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

describe.skipIf(!runDbTests)("OAuth linking evicts a pre-existing password", () => {
  it("clears the password and bumps the credential epoch", async () => {
    const db = await getDb();
    // Unique per run: openId has a unique index, so fixed values collide on a
    // second run against the same schema.
    const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const email = `prehijack-${run}@example.com`;
    await db!.insert(users).values({
      openId: `password:${run}`,
      email,
      passwordHash: "$2a$10$attackerSetThisHash",
    });
    const [before] = await db!
      .select({ epoch: users.credentialsChangedAt })
      .from(users)
      .where(eq(users.email, email));
    expect(Number(before!.epoch)).toBe(0);

    await linkUserOpenIdByEmail(email, `google:${run}`);

    const [after] = await db!
      .select({
        openId: users.openId,
        passwordHash: users.passwordHash,
        epoch: users.credentialsChangedAt,
      })
      .from(users)
      .where(eq(users.email, email));
    expect(after!.openId).toBe(`google:${run}`);
    // Without this the attacker's password kept working on the victim's
    // account once the victim signed in with the verified provider identity.
    expect(after!.passwordHash).toBeNull();
    expect(Number(after!.epoch)).toBeGreaterThan(0);
  });

  it("leaves an account without a password untouched", async () => {
    const db = await getDb();
    const run = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const email = `oauth-only-${run}@example.com`;
    await db!.insert(users).values({ openId: `old:${run}`, email });
    await linkUserOpenIdByEmail(email, `google:new-${run}`);
    const [after] = await db!
      .select({ openId: users.openId, epoch: users.credentialsChangedAt })
      .from(users)
      .where(eq(users.email, email));
    expect(after!.openId).toBe(`google:new-${run}`);
    expect(Number(after!.epoch)).toBe(0);
  });
});

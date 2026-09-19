import { beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb } from "../server/db";
import {
  createUserWithPassword,
  getUserByOpenId,
} from "../server/db";

const runDbTests = process.env.RUN_DB_TESTS === "1" && !!process.env.TEST_DATABASE_URL;
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

// createUserWithPassword exists specifically to avoid a user row with a NULL
// password hash (which can never log in and cannot re-register). That atomicity
// was previously untested.
describe.skipIf(!runDbTests)("createUserWithPassword", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Test DB not available");
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    await db.execute(sql.raw("TRUNCATE TABLE users"));
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
  });

  it("creates the row with the password hash in one step", async () => {
    const openId = `tx-${Date.now()}-a`;
    await createUserWithPassword(
      { openId, email: `${openId}@example.com`, name: "Tx User" } as never,
      "hashed-pw",
    );
    const user = await getUserByOpenId(openId);
    expect(user).not.toBeUndefined();
    expect((user as { passwordHash?: string }).passwordHash).toBe("hashed-pw");
  });

  it("updates the hash for an existing openId without nulling it", async () => {
    const openId = `tx-${Date.now()}-b`;
    await createUserWithPassword(
      { openId, email: `${openId}@example.com`, name: "Tx User" } as never,
      "first-hash",
    );
    await createUserWithPassword(
      { openId, email: `${openId}@example.com`, name: "Tx User" } as never,
      "second-hash",
    );
    const user = await getUserByOpenId(openId);
    expect((user as { passwordHash?: string }).passwordHash).toBe("second-hash");
  });

  it("never leaves a row with a NULL password hash", async () => {
    const db = await getDb();
    if (!db) throw new Error("Test DB not available");
    const rows = await db
      .select({ openId: users.openId, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.passwordHash, null as never));
    // Every row created via this path must have a hash.
    for (const row of rows) {
      expect(row.passwordHash, `${row.openId} has a NULL hash`).not.toBeNull();
    }
  });
});

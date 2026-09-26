import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { users } from "../drizzle/schema";
import * as db from "../server/db";
import { getDb } from "../server/db";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

describe.skipIf(!runDbTests)("password reset token is single-use", () => {
  it("rejects a second consume even when an in-memory copy exists", async () => {
    const connection = await getDb();
    await connection!.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    for (const table of ["password_reset_tokens", "users"]) {
      await connection!.execute(sql.raw(`TRUNCATE TABLE ${table}`));
    }
    await connection!.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
    await connection!.insert(users).values({ openId: "double-consume" });
    const [row] = await connection!
      .select({ id: users.id })
      .from(users)
      .where(eq(users.openId, "double-consume"));
    const userId = row!.id;

    const token = `tok-${Math.random().toString(36).slice(2)}`;
    await db.createPasswordResetToken(userId, token, Date.now() + 60_000);
    // A second create for the same token hits the unique index; its catch also
    // stores the token in the in-memory map — which is how a token ends up
    // dual-stored in practice (a post-commit error during creation does the
    // same).
    await db.createPasswordResetToken(userId, token, Date.now() + 60_000);

    expect(await db.resetPasswordWithToken(token, "hash-1")).toBe(userId);
    // The DB row now exists but is used. The in-memory copy must not satisfy a
    // second reset — that would let a token holder overwrite the victim's new
    // password (the single-use property).
    expect(await db.resetPasswordWithToken(token, "hash-2")).toBeNull();
    const [after] = await connection!
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId));
    expect(after!.passwordHash).toBe("hash-1");
  });
});

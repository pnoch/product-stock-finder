import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  emailVerificationTokens,
  passwordResetTokens,
  users,
} from "../drizzle/schema";
import {
  affectedRowsOf,
  consumeEmailVerificationToken,
  consumePasswordResetToken,
  createEmailVerificationToken,
  createPasswordResetToken,
  createUserWithPassword,
  deleteUserById,
  getDb,
  getEmailVerificationToken,
  getPasswordResetToken,
  getUserByEmail,
  getUserById,
  getUserByOpenId,
  linkUserOpenIdByEmail,
  purgeExpiredAuthTokens,
  setUserEmailVerified,
  updateUserPasswordHash,
  updateUserPasswordHashById,
  upsertUser,
} from "../server/db";

const TEST_URL = process.env.TEST_DATABASE_URL;
const runDbTests = Boolean(process.env.RUN_DB_TESTS) && Boolean(TEST_URL);
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

const HOUR = 3_600_000;

describe.skipIf(!runDbTests)("db helpers (DB)", () => {
  beforeEach(async () => {
    const db = await getDb();
    if (!db) return;
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
    for (const table of [
      "password_reset_tokens",
      "email_verification_tokens",
      "users",
    ]) {
      await db.execute(sql.raw(`TRUNCATE TABLE ${table}`));
    }
    await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
  });

  it("affectedRowsOf accepts both the tuple and direct-result shapes", () => {
    expect(affectedRowsOf([{ affectedRows: 3 }])).toBe(3);
    expect(affectedRowsOf({ affectedRows: 5 })).toBe(5);
    expect(affectedRowsOf(undefined)).toBe(0);
    expect(affectedRowsOf([{ affectedRows: "nope" }])).toBe(0);
  });

  it("upsertUser creates then updates and requires an openId", async () => {
    await expect(upsertUser({ openId: "" })).rejects.toThrow("openId");
    await upsertUser({ openId: "u1", email: "a@x.com", name: "A" });
    let user = await getUserByOpenId("u1");
    expect(user?.name).toBe("A");

    await upsertUser({ openId: "u1", name: "A2", role: "admin" });
    user = await getUserByOpenId("u1");
    expect(user?.name).toBe("A2");
    expect(user?.role).toBe("admin");
  });

  it("looks users up by openId, email, and id", async () => {
    await upsertUser({ openId: "u2", email: "b@x.com", name: "B" });
    const byOpenId = await getUserByOpenId("u2");
    expect(byOpenId?.email).toBe("b@x.com");
    expect((await getUserByEmail("b@x.com"))?.openId).toBe("u2");
    expect(await getUserByEmail("missing@x.com")).toBeNull();
    expect((await getUserById(byOpenId!.id))?.openId).toBe("u2");
    expect(await getUserById(999999)).toBeNull();
  });

  it("createUserWithPassword stores the hash atomically", async () => {
    await createUserWithPassword(
      { openId: "u3", email: "c@x.com", name: "C" },
      "hash-3",
    );
    const user = await getUserByOpenId("u3");
    expect(user?.passwordHash).toBe("hash-3");
  });

  it("links an OAuth openId and kills a pre-existing password", async () => {
    await createUserWithPassword(
      { openId: "local-1", email: "victim@x.com", name: "V" },
      "old-hash",
    );
    await linkUserOpenIdByEmail("victim@x.com", "oauth-1");
    const linked = await getUserByEmail("victim@x.com");
    expect(linked?.openId).toBe("oauth-1");
    expect(linked?.passwordHash).toBeNull();
    expect(linked?.credentialsChangedAt).toBeGreaterThan(0);
  });

  it("updates a password hash by openId and by id", async () => {
    await upsertUser({ openId: "u4", email: "d@x.com" });
    await updateUserPasswordHash("u4", "hash-4");
    expect((await getUserByOpenId("u4"))?.passwordHash).toBe("hash-4");

    const id = (await getUserByOpenId("u4"))!.id;
    const changedAt = await updateUserPasswordHashById(id, "hash-4b");
    const row = await getUserById(id);
    expect(row?.passwordHash).toBe("hash-4b");
    expect(changedAt).toBeGreaterThan(0);
  });

  it("deletes a user by id", async () => {
    await upsertUser({ openId: "u5" });
    const id = (await getUserByOpenId("u5"))!.id;
    await deleteUserById(id);
    expect(await getUserByOpenId("u5")).toBeUndefined();
  });

  it("consumes a password reset token exactly once", async () => {
    await upsertUser({ openId: "u6" });
    const id = (await getUserByOpenId("u6"))!.id;
    await createPasswordResetToken(id, "reset-1", Date.now() + HOUR);
    expect((await getPasswordResetToken("reset-1"))?.userId).toBe(id);

    const consumed = await consumePasswordResetToken("reset-1");
    expect(consumed?.userId).toBe(id);
    // Second use is rejected.
    expect(await consumePasswordResetToken("reset-1")).toBeNull();
  });

  it("rejects an expired password reset token", async () => {
    await upsertUser({ openId: "u7" });
    const id = (await getUserByOpenId("u7"))!.id;
    await createPasswordResetToken(id, "reset-exp", Date.now() - HOUR);
    expect(await consumePasswordResetToken("reset-exp")).toBeNull();
  });

  it("consumes an email verification token exactly once", async () => {
    await upsertUser({ openId: "u8" });
    const id = (await getUserByOpenId("u8"))!.id;
    await createEmailVerificationToken(id, "verify-1", Date.now() + HOUR);
    expect((await getEmailVerificationToken("verify-1"))?.userId).toBe(id);
    expect((await consumeEmailVerificationToken("verify-1"))?.userId).toBe(id);
    expect(await consumeEmailVerificationToken("verify-1")).toBeNull();
  });

  it("sets emailVerified", async () => {
    await upsertUser({ openId: "u9" });
    const id = (await getUserByOpenId("u9"))!.id;
    await setUserEmailVerified(id);
    expect((await getUserById(id))?.emailVerified).toBe(1);
  });

  it("purges expired and used auth tokens, keeping live ones", async () => {
    const db = await getDb();
    await upsertUser({ openId: "u10" });
    const id = (await getUserByOpenId("u10"))!.id;
    const now = Date.now();
    await db!.insert(passwordResetTokens).values([
      { userId: id, token: "pr-live", expiresAt: now + HOUR, usedAt: null },
      { userId: id, token: "pr-used", expiresAt: now + HOUR, usedAt: now - HOUR },
      { userId: id, token: "pr-dead", expiresAt: now - HOUR, usedAt: null },
    ]);
    await db!.insert(emailVerificationTokens).values([
      { userId: id, token: "ev-live", expiresAt: now + HOUR, usedAt: null },
      { userId: id, token: "ev-dead", expiresAt: now - HOUR, usedAt: null },
    ]);

    await purgeExpiredAuthTokens(now);

    expect((await getPasswordResetToken("pr-live"))?.userId).toBe(id);
    expect(await getPasswordResetToken("pr-used")).toBeNull();
    expect(await getPasswordResetToken("pr-dead")).toBeNull();
    expect((await getEmailVerificationToken("ev-live"))?.userId).toBe(id);
    expect(await getEmailVerificationToken("ev-dead")).toBeNull();

    const remainingUsers = await db!.select({ id: users.id }).from(users);
    expect(remainingUsers).toHaveLength(1);
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __clearEmailVerificationTokensForTest,
  __clearPasswordResetTokensForTest,
  affectedRowsOf,
  closeDb,
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

// This file deliberately exercises the no-database fallback paths: the real
// module is imported (not mocked) with DATABASE_URL removed.
const ORIGINAL_URL = process.env.DATABASE_URL;
const HOUR = 3_600_000;

beforeAll(async () => {
  delete process.env.DATABASE_URL;
  await closeDb();
});

afterAll(async () => {
  if (ORIGINAL_URL === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = ORIGINAL_URL;
  await closeDb();
});

beforeEach(() => {
  __clearPasswordResetTokensForTest();
  __clearEmailVerificationTokensForTest();
});

describe("db fallbacks without a database", () => {
  it("getDb returns null and affectedRowsOf handles both shapes", async () => {
    expect(await getDb()).toBeNull();
    expect(affectedRowsOf([{ affectedRows: 2 }])).toBe(2);
    expect(affectedRowsOf({ affectedRows: 4 })).toBe(4);
    expect(affectedRowsOf(undefined)).toBe(0);
  });

  it("user helpers no-op or return null", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(upsertUser({ openId: "" })).rejects.toThrow("openId");
    await expect(upsertUser({ openId: "u1" })).resolves.toBeUndefined();
    await expect(getUserByOpenId("u1")).resolves.toBeUndefined();
    await expect(getUserByEmail("a@x.com")).resolves.toBeNull();
    await expect(getUserById(5)).resolves.toBeNull();
    await expect(
      createUserWithPassword({ openId: "u2" }, "hash"),
    ).resolves.toBeUndefined();
    await expect(linkUserOpenIdByEmail("a@x.com", "u3")).resolves.toBeUndefined();
    await expect(
      updateUserPasswordHash("u3", "hash"),
    ).resolves.toBeUndefined();
    await expect(updateUserPasswordHashById(5, "hash")).resolves.toBeTypeOf(
      "number",
    );
    await expect(deleteUserById(5)).resolves.toBeUndefined();
    await expect(setUserEmailVerified(5)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("password reset tokens are single-use and expiry-checked in memory", async () => {
    await createPasswordResetToken(1, "reset-live", Date.now() + HOUR);
    expect((await getPasswordResetToken("reset-live"))?.userId).toBe(1);
    expect((await consumePasswordResetToken("reset-live"))?.userId).toBe(1);
    expect(await consumePasswordResetToken("reset-live")).toBeNull();

    await createPasswordResetToken(1, "reset-dead", Date.now() - HOUR);
    expect(await consumePasswordResetToken("reset-dead")).toBeNull();
    expect(await getPasswordResetToken("missing")).toBeNull();
  });

  it("email verification tokens are single-use and expiry-checked in memory", async () => {
    await createEmailVerificationToken(1, "verify-live", Date.now() + HOUR);
    expect((await getEmailVerificationToken("verify-live"))?.userId).toBe(1);
    expect((await consumeEmailVerificationToken("verify-live"))?.userId).toBe(1);
    expect(await consumeEmailVerificationToken("verify-live")).toBeNull();

    await createEmailVerificationToken(1, "verify-dead", Date.now() - HOUR);
    expect(await consumeEmailVerificationToken("verify-dead")).toBeNull();
  });

  it("purgeExpiredAuthTokens clears used/expired memory rows", async () => {
    const now = Date.now();
    await createPasswordResetToken(1, "live", now + HOUR);
    await createPasswordResetToken(1, "used", now + HOUR);
    await createPasswordResetToken(1, "dead", now - HOUR);
    await consumePasswordResetToken("used");
    await createEmailVerificationToken(1, "v-live", now + HOUR);
    await createEmailVerificationToken(1, "v-dead", now - HOUR);

    await purgeExpiredAuthTokens(now);

    expect(await getPasswordResetToken("live")).not.toBeNull();
    expect(await getPasswordResetToken("used")).toBeNull();
    expect(await getPasswordResetToken("dead")).toBeNull();
    expect(await getEmailVerificationToken("v-live")).not.toBeNull();
    expect(await getEmailVerificationToken("v-dead")).toBeNull();
  });
});

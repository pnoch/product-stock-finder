import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __clearEmailVerificationTokensForTest,
  __clearPasswordResetTokensForTest,
  closeDb,
  consumeEmailVerificationToken,
  consumePasswordResetToken,
  createEmailVerificationToken,
  createPasswordResetToken,
  getEmailVerificationToken,
  getPasswordResetToken,
  getUserByEmail,
  getUserByOpenId,
  purgeExpiredAuthTokens,
  upsertUser,
} from "../server/db";

// The pool is pointed at a closed port so every query rejects; getDb still
// returns a non-null client, so the per-operation catch fallbacks run.
const ORIGINAL_URL = process.env.DATABASE_URL;
const DEAD_URL = "mysql://root:root@127.0.0.1:1/none";
const HOUR = 3_600_000;

beforeAll(async () => {
  await closeDb();
  process.env.DATABASE_URL = DEAD_URL;
});

afterAll(async () => {
  await closeDb();
  if (ORIGINAL_URL === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = ORIGINAL_URL;
});

beforeEach(() => {
  __clearPasswordResetTokensForTest();
  __clearEmailVerificationTokensForTest();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("db fallbacks when the database is unreachable", () => {
  it("falls back to memory for reset tokens", async () => {
    await createPasswordResetToken(1, "reset-1", Date.now() + HOUR);
    expect((await getPasswordResetToken("reset-1"))?.userId).toBe(1);
    expect((await consumePasswordResetToken("reset-1"))?.userId).toBe(1);
    // Single-use: the memory fallback must still mark it consumed.
    expect(await consumePasswordResetToken("reset-1")).toBeNull();
  });

  it("falls back to memory for verification tokens", async () => {
    await createEmailVerificationToken(1, "verify-1", Date.now() + HOUR);
    expect((await getEmailVerificationToken("verify-1"))?.userId).toBe(1);
    expect((await consumeEmailVerificationToken("verify-1"))?.userId).toBe(1);
    expect(await consumeEmailVerificationToken("verify-1")).toBeNull();
  });

  it("propagates database errors for the non-fallback user helpers", async () => {
    // These deliberately surface the failure (no memory fallback), unlike the
    // auth-token helpers above.
    await expect(upsertUser({ openId: "u1" })).rejects.toBeTruthy();
    await expect(getUserByOpenId("u1")).rejects.toBeTruthy();
    await expect(getUserByEmail("a@x.com")).rejects.toBeTruthy();
  });

  it("propagates a purge failure so the caller can back off", async () => {
    await expect(purgeExpiredAuthTokens(Date.now())).rejects.toBeTruthy();
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/db")>();
  return { ...actual, getDb: vi.fn(async () => null) };
});

import {
  createPasswordResetToken,
  getPasswordResetToken,
  consumePasswordResetToken,
  createEmailVerificationToken,
  getEmailVerificationToken,
  purgeExpiredAuthTokens,
  __clearPasswordResetTokensForTest,
  __clearEmailVerificationTokensForTest,
} from "../server/db";

describe("purgeExpiredAuthTokens (memory fallback)", () => {
  beforeEach(() => {
    __clearPasswordResetTokensForTest();
    __clearEmailVerificationTokensForTest();
    vi.clearAllMocks();
  });

  it("removes expired and used reset tokens, keeps live ones", async () => {
    const now = Date.now();
    await createPasswordResetToken(1, "expired", now - 1000);
    await createPasswordResetToken(1, "live", now + 60_000);
    await createPasswordResetToken(1, "used", now + 60_000);
    const used = await consumePasswordResetToken("used");
    expect(used).not.toBeNull();

    await purgeExpiredAuthTokens(now);

    expect(await getPasswordResetToken("expired")).toBeNull();
    expect(await getPasswordResetToken("used")).toBeNull();
    expect(await getPasswordResetToken("live")).not.toBeNull();
  });

  it("removes expired and used verification tokens", async () => {
    const now = Date.now();
    await createEmailVerificationToken(1, "v-expired", now - 1);
    await createEmailVerificationToken(1, "v-live", now + 60_000);

    await purgeExpiredAuthTokens(now);

    expect(await getEmailVerificationToken("v-expired")).toBeNull();
    expect(await getEmailVerificationToken("v-live")).not.toBeNull();
  });
});

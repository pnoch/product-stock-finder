import { describe, expect, it } from "vitest";
// NOTE: no db mock here — without DATABASE_URL the real module uses its
// in-memory fallback, so these tests exercise the real consume logic.
import {
  consumePasswordResetToken,
  consumeEmailVerificationToken,
  createPasswordResetToken,
  createEmailVerificationToken,
} from "../server/db";

describe("atomic token consumption (real mem fallback)", () => {
  it("reset tokens succeed exactly once under parallel use", async () => {
    const token = `tok-atomic-${Date.now()}-r`;
    await createPasswordResetToken(42, token, Date.now() + 60000);
    const results = await Promise.all([
      consumePasswordResetToken(token),
      consumePasswordResetToken(token),
    ]);
    const successes = results.filter(Boolean);
    expect(successes).toHaveLength(1);
    expect(successes[0]).toMatchObject({ userId: 42 });
  });

  it("rejects expired reset tokens", async () => {
    const token = `tok-expired-${Date.now()}-r`;
    await createPasswordResetToken(42, token, Date.now() - 1000);
    expect(await consumePasswordResetToken(token)).toBeNull();
  });

  it("verification tokens succeed exactly once under parallel use", async () => {
    const token = `tok-atomic-${Date.now()}-v`;
    await createEmailVerificationToken(7, token, Date.now() + 60000);
    const results = await Promise.all([
      consumeEmailVerificationToken(token),
      consumeEmailVerificationToken(token),
    ]);
    const successes = results.filter(Boolean);
    expect(successes).toHaveLength(1);
    expect(successes[0]).toMatchObject({ userId: 7 });
  });
});

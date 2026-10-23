import { eq, lt, or } from "drizzle-orm";
import {
  emailVerificationTokens,
  passwordResetTokens,
  users,
} from "../drizzle/schema";
import { affectedRowsOf, getDb } from "./db-connection";
import { updateUserPasswordHashById } from "./db-users";

// ─── Password reset tokens (in-memory fallback when DB unavailable) ─────────
const memTokens = new Map<string, { userId: number; token: string; expiresAt: number; usedAt: number | null }>();

export async function createPasswordResetToken(userId: number, token: string, expiresAt: number) {
  const db = await getDb();
  if (!db) {
    memTokens.set(token, { userId, token, expiresAt, usedAt: null });
    return { id: Date.now(), userId, token, expiresAt, usedAt: null } as unknown;
  }
  try {
    await db.insert(passwordResetTokens).values({ userId, token, expiresAt });
    return { userId, token, expiresAt } as unknown;
  } catch {
    memTokens.set(token, { userId, token, expiresAt, usedAt: null });
    return { userId, token, expiresAt } as unknown;
  }
}

export async function getPasswordResetToken(token: string) {
  const db = await getDb();
  if (!db) return memTokens.get(token) ?? null;
  try {
    const rows = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token)).limit(1);
    if (rows[0]) return rows[0];
    return memTokens.get(token) ?? null;
  } catch {
    return memTokens.get(token) ?? null;
  }
}

/**
 * Atomically consumes a reset token: returns the row only if it is unused
 * and unexpired, marking it used in the same step. Concurrent uses of the
 * same token succeed exactly once (DB: SELECT ... FOR UPDATE inside a
 * transaction; mem fallback: synchronous check-and-set).
 */
export async function consumePasswordResetToken(token: string) {
  type Row = { userId: number; token: string; expiresAt: number; usedAt: number | null };
  const now = Date.now();
  const db = await getDb();
  if (!db) {
    const row = memTokens.get(token);
    if (!row || row.usedAt !== null || row.expiresAt <= now) return null;
    row.usedAt = now;
    memTokens.set(token, row);
    return row as Row;
  }
  try {
    const consumed = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.token, token))
        .limit(1)
        .for("update");
      const row = rows[0];
      if (!row || row.usedAt !== null || row.expiresAt <= now) return null;
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(eq(passwordResetTokens.token, token));
      return row;
    });
    if (consumed) return consumed;
  } catch {
    // Fall through: the token may live in the in-memory store.
  }
  // Only fall back when the DB has no row for this token at all. A row that
  // exists but is used/expired must stay rejected: a token dual-stored by a
  // post-commit error would otherwise be consumable a second time from memory.
  try {
    const present = await db
      .select({ token: passwordResetTokens.token })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token))
      .limit(1);
    if (present.length > 0) return null;
  } catch {
    // If even the existence check fails, fall through to the memory store.
  }
  // A transient DB error during creation put the token in the memory store
  // (getPasswordResetToken already falls back this way); without this the link
  // was permanently unusable once the DB recovered.
  const memRow = memTokens.get(token);
  if (!memRow || memRow.usedAt !== null || memRow.expiresAt <= now) return null;
  memRow.usedAt = now;
  memTokens.set(token, memRow);
  return memRow as Row;
}

export function __clearPasswordResetTokensForTest() {
  memTokens.clear();
}

// Consumes the token and applies the new password hash in one transaction, so a
// failure after consumption cannot burn the one-time token without changing the
// password (which forced the user to restart the whole reset flow).
export async function resetPasswordWithToken(
  token: string,
  passwordHash: string,
): Promise<number | null> {
  const now = Date.now();
  const db = await getDb();
  if (!db) {
    const row = memTokens.get(token);
    if (!row || row.usedAt !== null || row.expiresAt <= now) return null;
    row.usedAt = now;
    memTokens.set(token, row);
    await updateUserPasswordHashById(row.userId, passwordHash);
    return row.userId;
  }
  try {
    const applied = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.token, token))
        .limit(1)
        .for("update");
      const row = rows[0];
      if (!row || row.usedAt !== null || row.expiresAt <= now) return null;
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: now } as never)
        .where(eq(passwordResetTokens.token, token));
      await tx
        .update(users)
        .set({ passwordHash, credentialsChangedAt: now } as never)
        .where(eq(users.id, row.userId));
      return row.userId;
    });
    if (applied) return applied;
  } catch {
    // Fall through: the token may live in the in-memory store.
  }
  try {
    const present = await db
      .select({ token: passwordResetTokens.token })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token))
      .limit(1);
    if (present.length > 0) return null;
  } catch {
    // Fall through to the memory store.
  }
  const memRow = memTokens.get(token);
  if (!memRow || memRow.usedAt !== null || memRow.expiresAt <= now) return null;
  memRow.usedAt = now;
  memTokens.set(token, memRow);
  await updateUserPasswordHashById(memRow.userId, passwordHash);
  return memRow.userId;
}

// ─── Email verification tokens (in-memory fallback when DB unavailable) ─────
const memVerifyTokens = new Map<string, { userId: number; token: string; expiresAt: number; usedAt: number | null }>();

export async function createEmailVerificationToken(userId: number, token: string, expiresAt: number) {
  const db = await getDb();
  if (!db) {
    memVerifyTokens.set(token, { userId, token, expiresAt, usedAt: null });
    return { id: Date.now(), userId, token, expiresAt, usedAt: null } as unknown;
  }
  try {
    await db.insert(emailVerificationTokens).values({ userId, token, expiresAt });
    return { userId, token, expiresAt } as unknown;
  } catch {
    memVerifyTokens.set(token, { userId, token, expiresAt, usedAt: null });
    return { userId, token, expiresAt } as unknown;
  }
}

export async function getEmailVerificationToken(token: string) {
  const db = await getDb();
  if (!db) return memVerifyTokens.get(token) ?? null;
  try {
    const rows = await db.select().from(emailVerificationTokens).where(eq(emailVerificationTokens.token, token)).limit(1);
    if (rows[0]) return rows[0];
    return memVerifyTokens.get(token) ?? null;
  } catch {
    return memVerifyTokens.get(token) ?? null;
  }
}

/**
 * Atomically consumes a verification token (see consumePasswordResetToken).
 */
export async function consumeEmailVerificationToken(token: string) {
  type Row = { userId: number; token: string; expiresAt: number; usedAt: number | null };
  const now = Date.now();
  const db = await getDb();
  if (!db) {
    const row = memVerifyTokens.get(token);
    if (!row || row.usedAt !== null || row.expiresAt <= now) return null;
    row.usedAt = now;
    memVerifyTokens.set(token, row);
    return row as Row;
  }
  try {
    const consumed = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(emailVerificationTokens)
        .where(eq(emailVerificationTokens.token, token))
        .limit(1)
        .for("update");
      const row = rows[0];
      if (!row || row.usedAt !== null || row.expiresAt <= now) return null;
      await tx
        .update(emailVerificationTokens)
        .set({ usedAt: now })
        .where(eq(emailVerificationTokens.token, token));
      return row;
    });
    if (consumed) return consumed;
  } catch {
    // Fall through: the token may live in the in-memory store.
  }
  // See consumePasswordResetToken: only fall back when the DB has no row, so a
  // dual-stored token cannot be consumed twice.
  try {
    const present = await db
      .select({ token: emailVerificationTokens.token })
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.token, token))
      .limit(1);
    if (present.length > 0) return null;
  } catch {
    // Fall through to the memory store.
  }
  const memRow = memVerifyTokens.get(token);
  if (!memRow || memRow.usedAt !== null || memRow.expiresAt <= now) return null;
  memRow.usedAt = now;
  memVerifyTokens.set(token, memRow);
  return memRow as Row;
}

export async function setUserEmailVerified(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ emailVerified: 1 }).where(eq(users.id, id));
}

export function __clearEmailVerificationTokensForTest() {
  memVerifyTokens.clear();
}

// ─── Token retention ────────────────────────────────────────────────────────
// Reset/verification tokens are single-use and short-lived, but rows were never
// removed, so both tables grew without bound. Expired-or-used rows are deleted
// in bounded batches (called from the warmer tick).
const TOKEN_PURGE_BATCH_SIZE = 1000;
const TOKEN_PURGE_MAX_BATCHES_PER_TICK = 10;

export async function purgeExpiredAuthTokens(now: number): Promise<void> {
  for (const [key, row] of memTokens) {
    if (row.expiresAt <= now || row.usedAt !== null) memTokens.delete(key);
  }
  for (const [key, row] of memVerifyTokens) {
    if (row.expiresAt <= now || row.usedAt !== null) memVerifyTokens.delete(key);
  }
  const db = await getDb();
  if (!db) return;
  for (let batch = 0; batch < TOKEN_PURGE_MAX_BATCHES_PER_TICK; batch++) {
    const result = await db
      .delete(passwordResetTokens)
      .where(
        or(
          lt(passwordResetTokens.expiresAt, now),
          lt(passwordResetTokens.usedAt, now),
        ),
      )
      .limit(TOKEN_PURGE_BATCH_SIZE);
    const affected = affectedRowsOf(result);
    if (!Number.isFinite(affected) || affected < TOKEN_PURGE_BATCH_SIZE) break;
  }
  for (let batch = 0; batch < TOKEN_PURGE_MAX_BATCHES_PER_TICK; batch++) {
    const result = await db
      .delete(emailVerificationTokens)
      .where(
        or(
          lt(emailVerificationTokens.expiresAt, now),
          lt(emailVerificationTokens.usedAt, now),
        ),
      )
      .limit(TOKEN_PURGE_BATCH_SIZE);
    const affected = affectedRowsOf(result);
    if (!Number.isFinite(affected) || affected < TOKEN_PURGE_BATCH_SIZE) break;
  }
}

import { eq, lt, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { InsertUser, emailVerificationTokens, passwordResetTokens, users } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: ReturnType<typeof mysql.createPool> | null = null;
let creatingPool: Promise<ReturnType<typeof mysql.createPool>> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!_pool) {
    if (!creatingPool) {
      creatingPool = (async () => {
        const pool = mysql.createPool(url);
        _pool = pool;
        return pool;
      })().finally(() => {
        creatingPool = null;
      });
    }
    await creatingPool;
  }
  try {
    _db = drizzle(_pool as never);
  } catch (error) {
    console.error("[Database] Failed to connect:", error);
    throw error;
  }
  return _db;
}

export async function closeDb(): Promise<void> {
  if (_pool) {
    const pool = _pool;
    _pool = null;
    _db = null;
    await pool.end();
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === "admin") {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
}

// Links an OAuth identity to an existing email/password account. Without this,
// `upsertUser` with a new openId + an existing email matches the email unique
// index, updates that row, and leaves its original openId — so the subsequent
// getUserByOpenId(newOpenId) returns undefined and sign-in fails permanently.
export async function linkUserOpenIdByEmail(
  email: string,
  openId: string,
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ openId, lastSignedIn: new Date() } as never)
    .where(eq(users.email, email));
}

export async function updateUserPasswordHash(openId: string, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash } as any).where(eq(users.openId, openId));
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateUserPasswordHashById(id: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash } as any).where(eq(users.id, id));
}

export async function deleteUserById(id: number) {
  const db = await getDb();
  if (!db) return;
  // Cascade deletes watchlist_items, price_alerts, back_order_reminders, app_settings,
  // device_notification_configs, notification_events, device_push_tokens, password_reset_tokens,
  // shared_watchlists via FK onDelete cascade. Clean up tables without FK.
  try {
    const { revokedDevices } = await import("../drizzle/schema");
    try {
      await db.delete(revokedDevices).where(eq(revokedDevices.userId, id));
    } catch (e) {
      console.error("[Database] Failed to clean up revoked devices for user", id, e);
    }
  } catch (e) {
    console.error("[Database] Failed to load revoked devices schema", e);
  }
  await db.delete(users).where(eq(users.id, id));
}

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
    if (rows[0]) return rows[0] as unknown as { userId: number; token: string; expiresAt: number; usedAt: number | null };
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
    return await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(passwordResetTokens)
        .where(eq(passwordResetTokens.token, token))
        .limit(1)
        .for("update");
      const row = rows[0] as unknown as Row | undefined;
      if (!row || row.usedAt !== null || row.expiresAt <= now) return null;
      await tx
        .update(passwordResetTokens)
        .set({ usedAt: now } as any)
        .where(eq(passwordResetTokens.token, token));
      return row;
    });
  } catch {
    return null;
  }
}

export function __clearPasswordResetTokensForTest() {
  memTokens.clear();
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
    if (rows[0]) return rows[0] as unknown as { userId: number; token: string; expiresAt: number; usedAt: number | null };
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
    return await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(emailVerificationTokens)
        .where(eq(emailVerificationTokens.token, token))
        .limit(1)
        .for("update");
      const row = rows[0] as unknown as Row | undefined;
      if (!row || row.usedAt !== null || row.expiresAt <= now) return null;
      await tx
        .update(emailVerificationTokens)
        .set({ usedAt: now } as any)
        .where(eq(emailVerificationTokens.token, token));
      return row;
    });
  } catch {
    return null;
  }
}

export async function setUserEmailVerified(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ emailVerified: 1 } as any).where(eq(users.id, id));
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
          // usedAt is nullable; `lt` on a non-null value only matches used rows.
          lt(passwordResetTokens.usedAt, now),
        ),
      )
      .limit(TOKEN_PURGE_BATCH_SIZE);
    const affected = Number(
      (result as { affectedRows?: unknown }).affectedRows ?? 0,
    );
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
    const affected = Number(
      (result as { affectedRows?: unknown }).affectedRows ?? 0,
    );
    if (!Number.isFinite(affected) || affected < TOKEN_PURGE_BATCH_SIZE) break;
  }
}

// TODO: add feature queries here as your schema grows.

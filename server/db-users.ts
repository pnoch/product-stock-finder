import { eq, inArray } from "drizzle-orm";
import { InsertUser, users } from "../drizzle/schema";
import { getDb } from "./db-connection";

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
    const values: InsertUser = { openId: user.openId };
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
  const rows = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const hadPassword = Boolean(rows[0]?.passwordHash);
  await db
    .update(users)
    .set({
      openId,
      lastSignedIn: new Date(),
      // A verified provider identity proves control of the mailbox, so it may
      // take the account — but the password already on the row must die with
      // it. Leaving it meant whoever set it (an attacker who pre-registered the
      // address) kept a parallel login on the victim's account (pre-hijack).
      // The epoch bump also invalidates any session minted with that password.
      ...(hadPassword
        ? { passwordHash: null, credentialsChangedAt: Date.now() }
        : {}),
    } as never)
    .where(eq(users.email, email));
}

export async function updateUserPasswordHash(openId: string, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(users)
    .set({ passwordHash, credentialsChangedAt: Date.now() } as never)
    .where(eq(users.openId, openId));
}

// Creates the user row and its password hash in one transaction. Doing these as
// two writes could leave a user row with `passwordHash = NULL` if the process
// died in between — login always rejects and re-registration is blocked by the
// "already registered" check, so the account would be permanently unusable.
export async function createUserWithPassword(
  user: InsertUser,
  passwordHash: string,
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create user: database not available");
    return;
  }
  await db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values({
        openId: user.openId,
        email: user.email ?? null,
        name: user.name ?? null,
        loginMethod: user.loginMethod ?? "email",
        lastSignedIn: user.lastSignedIn ?? new Date(),
      } as never)
      .onDuplicateKeyUpdate({
        set: { lastSignedIn: new Date() },
      });
    await tx
      .update(users)
      .set({ passwordHash } as never)
      .where(eq(users.openId, user.openId));
  });
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

// Batched lookup for rosters and other list screens: one query instead of N.
export async function getUsersByIds(ids: number[]) {
  if (ids.length === 0) return [];
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(inArray(users.id, ids));
}

export async function updateUserPasswordHashById(
  id: number,
  passwordHash: string,
): Promise<number> {
  const credentialsChangedAt = Date.now();
  const db = await getDb();
  if (!db) return credentialsChangedAt;
  await db
    .update(users)
    .set({ passwordHash, credentialsChangedAt } as never)
    .where(eq(users.id, id));
  return credentialsChangedAt;
}

export async function deleteUserById(id: number) {
  const db = await getDb();
  if (!db) return;
  // Cascade deletes watchlist_items, price_alerts, back_order_reminders, app_settings,
  // device_notification_configs, notification_events, device_push_tokens, password_reset_tokens,
  // shared_watchlists via FK onDelete cascade. Clean up tables without FK.
  // device_labels has no FK to users, so collect this user's device ids and
  // delete their labels explicitly. Otherwise a later account binding the same
  // device id inherits the deleted user's label (cross-account leak).
  try {
    const { revokedDevices, deviceLabels, deviceNotificationConfigs, devicePushTokens } =
      await import("../drizzle/schema");
    const deviceIds = new Set<string>();
    for (const row of await db
      .select({ deviceId: deviceNotificationConfigs.deviceId })
      .from(deviceNotificationConfigs)
      .where(eq(deviceNotificationConfigs.userId, id))) {
      deviceIds.add(row.deviceId);
    }
    for (const row of await db
      .select({ deviceId: devicePushTokens.deviceId })
      .from(devicePushTokens)
      .where(eq(devicePushTokens.userId, id))) {
      deviceIds.add(row.deviceId);
    }
    if (deviceIds.size > 0) {
      await db
        .delete(deviceLabels)
        .where(inArray(deviceLabels.deviceId, [...deviceIds]));
    }
    try {
      await db.delete(revokedDevices).where(eq(revokedDevices.userId, id));
    } catch (e) {
      console.error("[Database] Failed to clean up revoked devices for user", id, e);
    }
  } catch (e) {
    console.error("[Database] Failed to clean up device rows for user", id, e);
  }
  await db.delete(users).where(eq(users.id, id));
}

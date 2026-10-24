import { and, eq, isNull, or } from "drizzle-orm";
import { getDb } from "./db";
import {
  deviceLabels,
  deviceNotificationConfigs,
  devicePushTokens,
  notificationEventDeliveries,
  notificationEvents,
  revokedDevices,
} from "../drizzle/schema";
import {
  listMemoryConfigDevices,
  removeMemoryDevice,
  clearDeviceDigestBuffer,
  clearUserDigestBuffer,
} from "./notifications";
import {
  listMemoryTokenDevices,
  removeMemoryToken,
} from "./push-notifications";
import {
  memoryLabels,
  memoryRevokedDevices,
} from "./devices-store";
import { getDeviceBinding, listDevicesForUser } from "./devices-list";

export async function unbindDevice(
  userId: number,
  deviceId: string,
): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    const config = listMemoryConfigDevices().find(
      (d) => d.deviceId === deviceId,
    );
    const token = listMemoryTokenDevices().find((d) => d.deviceId === deviceId);
    const boundTo = config?.userId ?? token?.userId ?? null;
    if (boundTo !== userId) return false;
    removeMemoryDevice(deviceId);
    removeMemoryToken(deviceId);
    memoryLabels.delete(deviceId);
    // Last binding gone: the user-scoped held drafts must go with it.
    const stillBound =
      listMemoryConfigDevices().some((d) => d.userId === userId) ||
      listMemoryTokenDevices().some((d) => d.userId === userId);
    if (!stillBound) clearUserDigestBuffer(userId);
    return true;
  }
  const configRows = await db
    .select()
    .from(deviceNotificationConfigs)
    .where(eq(deviceNotificationConfigs.deviceId, deviceId));
  const tokenRows = await db
    .select()
    .from(devicePushTokens)
    .where(eq(devicePushTokens.deviceId, deviceId));
  const boundTo = configRows[0]?.userId ?? tokenRows[0]?.userId ?? null;
  if (boundTo !== userId) return false;
  await db
    .delete(deviceNotificationConfigs)
    .where(eq(deviceNotificationConfigs.deviceId, deviceId));
  await db
    .delete(devicePushTokens)
    .where(eq(devicePushTokens.deviceId, deviceId));
  await db
    .delete(notificationEventDeliveries)
    .where(eq(notificationEventDeliveries.deviceId, deviceId));
  await db
    .delete(notificationEvents)
    .where(eq(notificationEvents.deviceId, deviceId));
  // Labels have no FK to users, so they must be removed explicitly or a
  // re-bound deviceId would inherit the previous owner's label.
  await db.delete(deviceLabels).where(eq(deviceLabels.deviceId, deviceId));
  // Held quiet-hours drafts live only in process memory even in DB mode, so
  // they must be dropped here too or a re-bound device flushes them.
  clearDeviceDigestBuffer(deviceId);
  // Same for the user-scoped buffer once the last binding is gone.
  const remainingConfigs = await db
    .select({ deviceId: deviceNotificationConfigs.deviceId })
    .from(deviceNotificationConfigs)
    .where(eq(deviceNotificationConfigs.userId, userId));
  const remainingTokens = await db
    .select({ deviceId: devicePushTokens.deviceId })
    .from(devicePushTokens)
    .where(eq(devicePushTokens.userId, userId));
  if (remainingConfigs.length === 0 && remainingTokens.length === 0) {
    clearUserDigestBuffer(userId);
  }
  return true;
}

export async function renameDevice(
  userId: number,
  deviceId: string,
  label: string,
): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    const config = listMemoryConfigDevices().find(
      (d) => d.deviceId === deviceId,
    );
    const token = listMemoryTokenDevices().find((d) => d.deviceId === deviceId);
    const boundTo = config?.userId ?? token?.userId ?? null;
    if (boundTo !== userId) return false;
    memoryLabels.set(deviceId, label);
    return true;
  }
  const configRows = await db
    .select()
    .from(deviceNotificationConfigs)
    .where(eq(deviceNotificationConfigs.deviceId, deviceId));
  const tokenRows = await db
    .select()
    .from(devicePushTokens)
    .where(eq(devicePushTokens.deviceId, deviceId));
  const boundTo = configRows[0]?.userId ?? tokenRows[0]?.userId ?? null;
  if (boundTo !== userId) return false;
  await db
    .insert(deviceLabels)
    .values({ deviceId, label, updatedAt: Date.now() })
    .onDuplicateKeyUpdate({ set: { label, updatedAt: Date.now() } });
  return true;
}

export async function signOutDevice(
  userId: number,
  deviceId: string,
): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    const config = listMemoryConfigDevices().find((d) => d.deviceId === deviceId);
    const token = listMemoryTokenDevices().find((d) => d.deviceId === deviceId);
    const boundTo = config?.userId ?? token?.userId ?? null;
    // Ownership is verified before writing: revoking first let any caller
    // create a (self, arbitrary deviceId) row, locking themselves out if they
    // later bound that id.
    if (boundTo !== userId) return false;
    // Revoke first so a crash between steps leaves the device unusable
    // rather than unbound-but-still-authenticated.
    memoryRevokedDevices.add(`${userId}:${deviceId}`);
    memoryLabels.delete(deviceId);
    return unbindDevice(userId, deviceId);
  }
  const binding = await getDeviceBinding(deviceId);
  if (binding.userId !== userId) return false;
  // Revoke before unbinding: if the process dies between these steps the
  // device stays revoked (safe) instead of unbound-but-token-valid (unsafe).
  await db
    .insert(revokedDevices)
    .values({ deviceId, userId, revokedAt: Date.now() })
    .onDuplicateKeyUpdate({ set: { revokedAt: Date.now() } });
  const unbound = await unbindDevice(userId, deviceId);
  if (!unbound) return false;
  // deviceLabels is deleted by unbindDevice.
  return true;
}

/**
 * Revokes every device bound to the user, optionally keeping one.
 *
 * Used after a credential change: the session cookie/JWT issued before it is
 * still otherwise valid, so a password reset — the recovery path for a
 * compromised account — must revoke the devices or an attacker's session
 * survives until the token expires.
 */
export async function revokeAllDevicesForUser(
  userId: number,
  exceptDeviceId?: string | null,
): Promise<number> {
  const devices = await listDevicesForUser(userId);
  let revoked = 0;
  for (const device of devices) {
    if (!device.deviceId || device.deviceId === exceptDeviceId) continue;
    if (await signOutDevice(userId, device.deviceId)) revoked += 1;
  }
  // A session that never carried a device id is invisible to the enumeration
  // above, so credential changes also write a user-scoped wildcard that the
  // request path checks for device-less sessions. A later successful sign-in
  // clears it (proving the new password), so it cannot lock anyone out.
  const db = await getDb();
  if (!db) {
    memoryRevokedDevices.add(`${userId}:*`);
  } else {
    await db
      .insert(revokedDevices)
      .values({ deviceId: "*", userId, revokedAt: Date.now() })
      .onDuplicateKeyUpdate({ set: { revokedAt: Date.now() } });
  }
  return revoked;
}

export async function unrevokeDevice(
  userId: number,
  deviceId: string,
): Promise<void> {
  const db = await getDb();
  if (!db) {
    memoryRevokedDevices.delete(`${userId}:${deviceId}`);
    memoryRevokedDevices.delete(`*:${deviceId}`);
    // Signing in proves the current credentials, so lift the user's wildcard
    // (it exists to kill sessions issued before a credential change).
    memoryRevokedDevices.delete(`${userId}:*`);
    return;
  }
  await db
    .delete(revokedDevices)
    .where(
      and(
        or(
          eq(revokedDevices.deviceId, deviceId),
          eq(revokedDevices.deviceId, "*"),
        ),
        or(eq(revokedDevices.userId, userId), isNull(revokedDevices.userId)),
      ),
    );
}

import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "./db";
import {
  deviceLabels,
  deviceNotificationConfigs,
  devicePushTokens,
} from "../drizzle/schema";
import {
  listMemoryConfigDevices,
} from "./notifications";
import {
  listMemoryTokenDevices,
} from "./push-notifications";
import {
  memoryLabels,
  DeviceInfo,
} from "./devices-store";

export async function listDevicesForUser(
  userId: number,
): Promise<DeviceInfo[]> {
  const db = await getDb();
  if (!db) {
    const configDevices = listMemoryConfigDevices();
    const tokenDevices = listMemoryTokenDevices();
    const byDevice = new Map<string, DeviceInfo>();
    for (const c of configDevices) {
      if (c.userId !== userId) continue;
      byDevice.set(c.deviceId, {
        deviceId: c.deviceId,
        platform: null,
        lastSeenAt: 0,
        label: memoryLabels.get(c.deviceId) ?? null,
      });
    }
    for (const t of tokenDevices) {
      if (t.userId !== userId) continue;
      const existing = byDevice.get(t.deviceId);
      byDevice.set(t.deviceId, {
        deviceId: t.deviceId,
        platform: existing?.platform ?? t.platform,
        lastSeenAt: Math.max(existing?.lastSeenAt ?? 0, 0),
        label: existing?.label ?? memoryLabels.get(t.deviceId) ?? null,
      });
    }
    return [...byDevice.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  }
  const configRows = await db
    .select()
    .from(deviceNotificationConfigs)
    .where(eq(deviceNotificationConfigs.userId, userId));
  const tokenRows = await db
    .select()
    .from(devicePushTokens)
    .where(eq(devicePushTokens.userId, userId));
  // Scope the label lookup to this user's own devices — never scan all labels.
  const ownDeviceIds = [
    ...new Set([
      ...configRows.map((r) => r.deviceId),
      ...tokenRows.map((r) => r.deviceId),
    ]),
  ];
  const labelRows =
    ownDeviceIds.length === 0
      ? []
      : await db
          .select()
          .from(deviceLabels)
          .where(inArray(deviceLabels.deviceId, ownDeviceIds));
  const labelMap = new Map(labelRows.map((r) => [r.deviceId, r.label]));
  const byDevice = new Map<string, DeviceInfo>();
  for (const row of configRows) {
    const existing = byDevice.get(row.deviceId);
    byDevice.set(row.deviceId, {
      deviceId: row.deviceId,
      platform: existing?.platform ?? null,
      lastSeenAt: Math.max(existing?.lastSeenAt ?? 0, row.updatedAt),
      label: labelMap.get(row.deviceId) ?? null,
    });
  }
  for (const row of tokenRows) {
    const existing = byDevice.get(row.deviceId);
    byDevice.set(row.deviceId, {
      deviceId: row.deviceId,
      platform: existing?.platform ?? row.platform,
      lastSeenAt: Math.max(existing?.lastSeenAt ?? 0, row.updatedAt),
      label: labelMap.get(row.deviceId) ?? null,
    });
  }
  return [...byDevice.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

export async function getDeviceBinding(
  deviceId: string,
): Promise<{ userId: number | null }> {
  const db = await getDb();
  if (!db) {
    // Mirror the DB branch: an anonymous config (userId null) must not mask a
    // user-bound push token.
    const config = listMemoryConfigDevices().find(
      (d) => d.deviceId === deviceId && d.userId != null,
    );
    if (config) return { userId: config.userId };
    const token = listMemoryTokenDevices().find(
      (d) => d.deviceId === deviceId && d.userId != null,
    );
    return { userId: token?.userId ?? null };
  }
  const configRows = await db
    .select()
    .from(deviceNotificationConfigs)
    .where(eq(deviceNotificationConfigs.deviceId, deviceId));
  // A legacy anonymous config (userId NULL) must not mask a user-bound push
  // token: returning null would let any authenticated user claim the device.
  const configUserId = configRows.find((r) => r.userId != null)?.userId;
  if (configUserId != null) {
    return { userId: configUserId };
  }
  const tokenRows = await db
    .select()
    .from(devicePushTokens)
    .where(eq(devicePushTokens.deviceId, deviceId));
  const tokenUserId = tokenRows.find((r) => r.userId != null)?.userId;
  return { userId: tokenUserId ?? configRows[0]?.userId ?? null };
}

export async function assertDeviceAccess(
  userId: number,
  deviceId: string,
): Promise<void> {
  const { userId: boundTo } = await getDeviceBinding(deviceId);
  if (boundTo === null || boundTo === userId) return;
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Notification device belongs to another account",
  });
}

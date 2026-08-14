import { eq } from "drizzle-orm";
import {
  deviceNotificationConfigs,
  devicePushTokens,
  notificationEventDeliveries,
  notificationEvents,
} from "../drizzle/schema";
import { getDb } from "./db";
import { listMemoryConfigDevices, removeMemoryDevice } from "./notifications";
import {
  listMemoryTokenDevices,
  removeMemoryToken,
} from "./push-notifications";

export interface DeviceInfo {
  deviceId: string;
  platform: string | null;
  lastSeenAt: number;
}

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
      });
    }
    for (const t of tokenDevices) {
      if (t.userId !== userId) continue;
      const existing = byDevice.get(t.deviceId);
      byDevice.set(t.deviceId, {
        deviceId: t.deviceId,
        platform: existing?.platform ?? t.platform,
        lastSeenAt: Math.max(existing?.lastSeenAt ?? 0, 0),
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
  const byDevice = new Map<string, DeviceInfo>();
  for (const row of configRows) {
    const existing = byDevice.get(row.deviceId);
    byDevice.set(row.deviceId, {
      deviceId: row.deviceId,
      platform: existing?.platform ?? null,
      lastSeenAt: Math.max(existing?.lastSeenAt ?? 0, row.updatedAt),
    });
  }
  for (const row of tokenRows) {
    const existing = byDevice.get(row.deviceId);
    byDevice.set(row.deviceId, {
      deviceId: row.deviceId,
      platform: existing?.platform ?? row.platform,
      lastSeenAt: Math.max(existing?.lastSeenAt ?? 0, row.updatedAt),
    });
  }
  return [...byDevice.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

export async function getDeviceBinding(
  deviceId: string,
): Promise<{ userId: number | null }> {
  const db = await getDb();
  if (!db) {
    const config = listMemoryConfigDevices().find(
      (d) => d.deviceId === deviceId,
    );
    if (config) return { userId: config.userId };
    const token = listMemoryTokenDevices().find((d) => d.deviceId === deviceId);
    return { userId: token?.userId ?? null };
  }
  const configRows = await db
    .select()
    .from(deviceNotificationConfigs)
    .where(eq(deviceNotificationConfigs.deviceId, deviceId));
  if (configRows.length > 0) {
    return { userId: configRows[0].userId };
  }
  const tokenRows = await db
    .select()
    .from(devicePushTokens)
    .where(eq(devicePushTokens.deviceId, deviceId));
  return { userId: tokenRows[0]?.userId ?? null };
}

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
  return true;
}

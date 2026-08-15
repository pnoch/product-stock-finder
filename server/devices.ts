import { eq } from "drizzle-orm";
import {
  deviceLabels,
  deviceNotificationConfigs,
  devicePushTokens,
  notificationEventDeliveries,
  notificationEvents,
  revokedDevices,
} from "../drizzle/schema";
import { getDb } from "./db";
import { listMemoryConfigDevices, removeMemoryDevice } from "./notifications";
import {
  listMemoryTokenDevices,
  removeMemoryToken,
} from "./push-notifications";

export const STALE_DEVICE_MS = 30 * 24 * 60 * 60 * 1000;
const memoryLabels = new Map<string, string>();
const memoryRevokedDevices = new Set<string>();

export interface DeviceInfo {
  deviceId: string;
  platform: string | null;
  lastSeenAt: number;
  label: string | null;
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
  const labelRows = await db.select().from(deviceLabels);
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
  const unbound = await unbindDevice(userId, deviceId);
  if (!unbound) return false;
  const db = await getDb();
  if (!db) {
    memoryRevokedDevices.add(deviceId);
    memoryLabels.delete(deviceId);
    return true;
  }
  await db
    .insert(revokedDevices)
    .values({ deviceId, revokedAt: Date.now() })
    .onDuplicateKeyUpdate({ set: { revokedAt: Date.now() } });
  await db.delete(deviceLabels).where(eq(deviceLabels.deviceId, deviceId));
  return true;
}

export async function cleanupStaleDevices(
  userId: number,
  cutoffMs: number,
): Promise<number> {
  const devices = await listDevicesForUser(userId);
  let removed = 0;
  for (const device of devices) {
    if (device.lastSeenAt > 0 && device.lastSeenAt < cutoffMs) {
      await unbindDevice(userId, device.deviceId);
      removed += 1;
    }
  }
  return removed;
}

export async function isDeviceRevoked(deviceId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return memoryRevokedDevices.has(deviceId);
  const rows = await db
    .select()
    .from(revokedDevices)
    .where(eq(revokedDevices.deviceId, deviceId));
  return rows.length > 0;
}

export function clearDevicesForTests(): void {
  memoryLabels.clear();
  memoryRevokedDevices.clear();
}

import { and, eq, isNull, or } from "drizzle-orm";
import { getDb } from "./db";
import {
  revokedDevices,
} from "../drizzle/schema";
import {
  memoryLabels,
  memoryRevokedDevices,
} from "./devices-store";

export async function isDeviceRevoked(
  userId: number,
  deviceId: string,
): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    return (
      memoryRevokedDevices.has(`${userId}:${deviceId}`) ||
      memoryRevokedDevices.has(`*:${deviceId}`)
    );
  }
  const rows = await db
    .select()
    .from(revokedDevices)
    .where(
      and(
        eq(revokedDevices.deviceId, deviceId),
        or(eq(revokedDevices.userId, userId), isNull(revokedDevices.userId)),
      ),
    );
  return rows.length > 0;
}

export function clearDevicesForTests(): void {
  memoryLabels.clear();
  memoryRevokedDevices.clear();
}

// Test-only: mirrors the DB legacy NULL-userId global block in the memory backend.
export function seedGlobalRevocationForTests(deviceId: string): void {
  memoryRevokedDevices.add(`*:${deviceId}`);
}

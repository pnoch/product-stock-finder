import { lt } from "drizzle-orm";
import { affectedRowsOf, getDb } from "./db";
import {
  revokedDevices,
} from "../drizzle/schema";
import {
  memoryRevokedDevices,
} from "./devices-store";
import { listDevicesForUser } from "./devices-list";
import { unbindDevice } from "./devices-mutations";

export async function cleanupStaleDevices(
  userId: number,
  cutoffMs: number,
  excludeDeviceId?: string | null,
): Promise<number> {
  const devices = await listDevicesForUser(userId);
  let removed = 0;
  for (const device of devices) {
    if (device.deviceId === excludeDeviceId) continue;
    if (device.lastSeenAt > 0 && device.lastSeenAt < cutoffMs) {
      await unbindDevice(userId, device.deviceId);
      removed += 1;
    }
  }
  return removed;
}

// revoked_devices rows are only removed on unrevoke (sign-in) or user deletion,
// so devices that never sign back in accumulate forever and feed the
// per-request isDeviceRevoked scan. Drop rows past the retention window.
const REVOKED_DEVICE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const REVOKED_DEVICE_PURGE_BATCH = 1000;
const REVOKED_DEVICE_PURGE_MAX_BATCHES = 10;

export async function purgeOldRevokedDevices(now: number): Promise<void> {
  const cutoff = now - REVOKED_DEVICE_RETENTION_MS;
  const db = await getDb();
  if (!db) {
    for (const key of memoryRevokedDevices) {
      // Keys are `userId:deviceId` or `*:deviceId`; no timestamp in memory, so
      // leave them (test-only path).
      void key;
    }
    return;
  }
  // Drain in batches like the other retention jobs; a single LIMIT would only
  // remove 1000 rows per tick and never catch up on a large backlog.
  for (let batch = 0; batch < REVOKED_DEVICE_PURGE_MAX_BATCHES; batch++) {
    const result = await db
      .delete(revokedDevices)
      .where(lt(revokedDevices.revokedAt, cutoff))
      .limit(REVOKED_DEVICE_PURGE_BATCH);
    const affected = affectedRowsOf(result);
    if (affected < REVOKED_DEVICE_PURGE_BATCH) break;
  }
}

import { createTRPCClient } from "./trpc";
import type { DeviceInfo } from "../server/devices";

export type { DeviceInfo } from "../server/devices";

const TIMEOUT_MS = 4000;

export async function fetchDevices(): Promise<DeviceInfo[] | null> {
  try {
    const client = createTRPCClient();
    const result = await Promise.race([
      client.devices.list.query(),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_MS),
      ),
    ]);
    return result?.devices ?? null;
  } catch {
    return null;
  }
}

export async function fetchCurrentDeviceBinding(): Promise<{
  userId: number | null;
} | null> {
  try {
    const { getDeviceId } = await import("./device-id");
    const deviceId = await getDeviceId();
    const client = createTRPCClient();
    const result = await Promise.race([
      client.devices.current.query({ deviceId }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_MS),
      ),
    ]);
    return result ? { userId: result.userId } : null;
  } catch {
    return null;
  }
}

export async function unbindDevice(deviceId: string): Promise<boolean> {
  try {
    const client = createTRPCClient();
    const result = await Promise.race([
      client.devices.unbind.mutate({ deviceId }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_MS),
      ),
    ]);
    return result?.unbound ?? false;
  } catch {
    return false;
  }
}

export async function bindCurrentDevice(): Promise<void> {
  try {
    const { registerPushToken } = await import("./push-token");
    const { syncServerNotifications } = await import("./server-notifications");
    await registerPushToken();
    await syncServerNotifications();
  } catch {
    // best-effort
  }
}

export async function renameDevice(
  deviceId: string,
  label: string,
): Promise<boolean> {
  try {
    const client = createTRPCClient();
    const result = await Promise.race([
      client.devices.rename.mutate({ deviceId, label }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_MS),
      ),
    ]);
    return result?.renamed ?? false;
  } catch {
    return false;
  }
}

export async function signOutDevice(deviceId: string): Promise<boolean> {
  try {
    const client = createTRPCClient();
    const result = await Promise.race([
      client.devices.signOut.mutate({ deviceId }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_MS),
      ),
    ]);
    return result?.signedOut ?? false;
  } catch {
    return false;
  }
}

export async function cleanupStaleDevices(): Promise<number> {
  try {
    const client = createTRPCClient();
    const result = await Promise.race([
      client.devices.cleanupStale.mutate(),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_MS),
      ),
    ]);
    return result?.removed ?? 0;
  } catch {
    return 0;
  }
}

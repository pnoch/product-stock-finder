export const STALE_DEVICE_MS = 30 * 24 * 60 * 60 * 1000;
export const memoryLabels = new Map<string, string>();
export const memoryRevokedDevices = new Set<string>();

export interface DeviceInfo {
  deviceId: string;
  platform: string | null;
  lastSeenAt: number;
  label: string | null;
}

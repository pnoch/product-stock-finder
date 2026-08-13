import { createTRPCClient } from "./trpc";
import type { NotificationConfig, NotificationEvent } from "../server/notifications";

const TIMEOUT_MS = 4000;

export async function uploadNotificationConfig(
  deviceId: string,
  config: NotificationConfig,
): Promise<boolean> {
  try {
    const client = createTRPCClient();
    await Promise.race([
      client.notifications.uploadConfig.mutate({ deviceId, ...config }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function pullNotificationEvents(
  deviceId: string,
): Promise<NotificationEvent[]> {
  try {
    const client = createTRPCClient();
    const result = await Promise.race([
      client.notifications.pull.query({ deviceId }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);
    return result?.events ?? [];
  } catch {
    return [];
  }
}
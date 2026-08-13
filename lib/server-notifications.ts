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

export async function syncServerNotifications(): Promise<void> {
  try {
    const { getDeviceId } = await import("./device-id");
    const { getAlerts, getStockWatches, getBackOrderReminders } = await import("./storage");
    const { scheduleServerEventNotification } = await import("./notifications");
    const deviceId = await getDeviceId();

    const alerts = await getAlerts();
    const activeAlerts = alerts
      .filter((a) => a.isActive && !a.triggeredAt)
      .map((a) => ({
        id: a.id,
        productId: a.productId,
        targetPrice: a.targetPrice,
        currency: a.currency,
        distributorId: a.distributorId,
      }));

    const stockWatches = (await getStockWatches()).map((w) => ({
      id: w.id,
      productId: w.productId,
      distributorId: w.distributorId,
    }));

    const dateReminders = (await getBackOrderReminders())
      .filter((r) => r.reminderType === "date")
      .map((r) => ({
        id: r.id,
        productId: r.productId,
        distributorId: r.distributorId,
        reminderDate: r.reminderDate,
      }));

    await uploadNotificationConfig(deviceId, {
      alerts: activeAlerts,
      stockWatches,
      dateReminders,
    });

    const events = await pullNotificationEvents(deviceId);
    for (const event of events) {
      await scheduleServerEventNotification(event.title, event.body);
      await reconcileEvent(event);
    }
  } catch {
    // server notification sync is best-effort
  }
}

async function reconcileEvent(event: {
  type: string;
  alertId?: string;
  watchId?: string;
  triggeredPrice?: number;
}): Promise<void> {
  const { deactivateAlert, removeStockWatch } = await import("./storage");
  if (event.type === "price_drop" && event.alertId) {
    await deactivateAlert(event.alertId, event.triggeredPrice ?? 0);
  }
  if (event.type === "restock" && event.watchId) {
    await removeStockWatch(event.watchId);
  }
}
import { storage } from "./storage";
import { createTRPCClient } from "./lib/trpc";

const DEVICE_ID_KEY = "device_id";
const TIMEOUT_MS = 4000;

interface PushConfig {
  alerts: Array<{
    id: string;
    productId: string;
    targetPrice: number;
    currency: string;
    distributorId?: string;
  }>;
  stockWatches: Array<{
    id: string;
    productId: string;
    distributorId: string;
    lastKnownStatus?: string;
  }>;
  dateReminders: Array<{
    id: string;
    productId: string;
    distributorId: string;
    reminderDate: string;
  }>;
}

interface PushEvent {
  id: string;
  type: string;
  title: string;
  body: string;
  alertId?: string;
  watchId?: string;
  reminderId?: string;
  triggeredPrice?: number;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function getDesktopDeviceId(): Promise<string> {
  let id = await localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateId();
    await localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

async function uploadConfig(
  deviceId: string,
  config: PushConfig,
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

async function pullEvents(deviceId: string): Promise<PushEvent[]> {
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

async function reconcileEvent(event: PushEvent): Promise<void> {
  if (event.type === "price_drop" && event.alertId) {
    await storage.deactivateAlert(event.alertId, event.triggeredPrice ?? 0);
  }
  if (event.type === "restock" && event.watchId) {
    await storage.removeStockWatch(event.watchId);
  }
  if (event.type === "reminder" && event.reminderId) {
    await storage.removeBackOrderReminder(event.reminderId);
  }
}

export async function syncDesktopNotifications(): Promise<void> {
  try {
    const deviceId = await getDesktopDeviceId();
    const alerts = await storage.getAlerts();
    const activeAlerts = alerts
      .filter((a) => a.isActive && !a.triggeredAt)
      .map((a) => ({
        id: a.id,
        productId: a.productId,
        targetPrice: a.targetPrice,
        currency: a.currency,
        distributorId: a.distributorId,
      }));
    const activeAlertIds = new Set(activeAlerts.map((a) => a.id));
    const stockWatches = (await storage.getStockWatches()).map((w) => ({
      id: w.id,
      productId: w.productId,
      distributorId: w.distributorId,
      lastKnownStatus: w.lastKnownStatus,
    }));
    const dateReminders = (await storage.getBackOrderReminders())
      .filter((r) => r.reminderType === "date")
      .map((r) => ({
        id: r.id,
        productId: r.productId,
        distributorId: r.distributorId,
        reminderDate: r.reminderDate,
      }));

    await uploadConfig(deviceId, {
      alerts: activeAlerts,
      stockWatches,
      dateReminders,
    });

    const events = await pullEvents(deviceId);
    const { sendDesktopNotification } = await import("./notifications");
    for (const event of events) {
      try {
        const stalePriceDrop =
          event.type === "price_drop" &&
          event.alertId &&
          !activeAlertIds.has(event.alertId);
        if (!stalePriceDrop) {
          await sendDesktopNotification(event.title, event.body);
        }
        await reconcileEvent(event);
      } catch {
        // skip this event; keep processing the rest
      }
    }
  } catch {
    // desktop notification sync is best-effort
  }
}

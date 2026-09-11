import { storage } from "./storage";
import { createTRPCClient } from "./lib/trpc";

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
  healthEvents?: Array<{
    id: string;
    distributorId: string;
    distributorName: string;
    status: "blocked" | "error";
    title: string;
    body: string;
    createdAt: number;
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

async function uploadConfig(config: PushConfig): Promise<boolean> {
  try {
    const client = createTRPCClient();
    await Promise.race([
      client.notifications.uploadConfig.mutate({ ...config }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_MS),
      ),
    ]);
    return true;
  } catch {
    return false;
  }
}

async function pullEvents(): Promise<PushEvent[]> {
  try {
    const client = createTRPCClient();
    const result = await Promise.race([
      client.notifications.pull.query({}),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_MS),
      ),
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
    const pendingHealthEvents = await storage.getPendingHealthEvents();
    const healthEvents = pendingHealthEvents.map((e) => ({
      id:
        typeof (e as { id?: unknown }).id === "string" &&
        ((e as { id?: string }).id as string).length > 0
          ? (e as { id: string }).id
          : `health-${e.distributorId}-${e.status}-${e.createdAt}`,
      distributorId: e.distributorId,
      distributorName: e.distributorName,
      status: e.status,
      title: e.title,
      body: e.body,
      createdAt: e.createdAt,
    }));

    const uploadOk = await uploadConfig({
      alerts: activeAlerts,
      stockWatches,
      dateReminders,
      healthEvents: healthEvents.length > 0 ? healthEvents : undefined,
    });
    if (uploadOk && pendingHealthEvents.length > 0) {
      await storage.clearPendingHealthEvents();
    }

    const events = await pullEvents();
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

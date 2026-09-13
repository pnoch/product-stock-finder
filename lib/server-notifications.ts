import { createTRPCClient } from "./trpc";
import type {
  NotificationConfig,
  NotificationEvent,
} from "../server/notifications";

const TIMEOUT_MS = 4000;

export async function uploadNotificationConfig(
  config: NotificationConfig,
  healthEvents?: Array<{
    id: string;
    distributorId: string;
    distributorName: string;
    status: "blocked" | "error";
    title: string;
    body: string;
    createdAt: number;
  }>,
): Promise<boolean> {
  try {
    const client = createTRPCClient();
    const result = await Promise.race([
      client.notifications.uploadConfig.mutate({
        ...config,
        healthEvents,
      }).then(() => true as const),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), TIMEOUT_MS),
      ),
    ]);
    return result === true;
  } catch {
    return false;
  }
}

export async function uploadHealthEventToServer(event: {
  distributorId: string;
  distributorName: string;
  status: "blocked" | "error";
  title: string;
  body: string;
  createdAt: number;
}): Promise<void> {
  const { getPendingHealthEvents, savePendingHealthEvents } = await import("./storage");
  const pending = await getPendingHealthEvents();
  pending.push(event);
  await savePendingHealthEvents(pending);
}

export async function pullNotificationEvents(): Promise<NotificationEvent[]> {
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

let syncInFlight: Promise<void> | null = null;

export function syncServerNotifications(): Promise<void> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = runSyncServerNotifications().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

async function runSyncServerNotifications(): Promise<void> {
  try {
    const {
      getSettings,
      getAlerts,
      getStockWatches,
      getBackOrderReminders,
      getDisplayedEventIds,
      recordDisplayedEventId,
      recordNotificationEvent,
    } = await import("./storage");
    const { scheduleServerEventNotification } = await import("./notifications");

    const { getPendingHealthEvents, clearPendingHealthEvents } =
      await import("./storage");
    const pendingHealthEvents = await getPendingHealthEvents();
    const settings = await getSettings();

    // Master switch off: retract the server-side config so evaluation stops,
    // drop the health buffer (intentional suppression, not loss), and skip
    // pulling/displaying events entirely.
    if (!settings.notificationsEnabled) {
      await uploadNotificationConfig({
        alerts: [],
        stockWatches: [],
        dateReminders: [],
      });
      if (pendingHealthEvents.length > 0) {
        await clearPendingHealthEvents();
      }
      return;
    }

    const alerts = await getAlerts();
    const activeAlerts = settings.priceAlerts
      ? alerts
          .filter((a) => a.isActive && !a.triggeredAt)
          .map((a) => ({
            id: a.id,
            productId: a.productId,
            targetPrice: a.targetPrice,
            currency: a.currency,
            distributorId: a.distributorId,
            direction: a.direction,
            snoozedUntil: a.snoozedUntil,
          }))
      : [];
    const activeAlertIds = new Set(activeAlerts.map((a) => a.id));

    const stockWatches = settings.stockAlerts
      ? (await getStockWatches()).map((w) => ({
          id: w.id,
          productId: w.productId,
          distributorId: w.distributorId,
          lastKnownStatus: w.lastKnownStatus,
        }))
      : [];

    const dateReminders = (await getBackOrderReminders())
      .filter((r) => r.reminderType === "date")
      .map((r) => ({
        id: r.id,
        productId: r.productId,
        distributorId: r.distributorId,
        reminderDate: r.reminderDate,
      }));

    const uploadOk = await uploadNotificationConfig(
      {
        alerts: activeAlerts,
        stockWatches,
        dateReminders,
        quietHours: settings.quietHours ?? undefined,
      },
      settings.healthAlerts && pendingHealthEvents.length > 0
        ? pendingHealthEvents.map((e) => ({
            id: `health-${e.distributorId}-${e.status}-${e.createdAt}`,
            distributorId: e.distributorId,
            distributorName: e.distributorName,
            status: e.status,
            title: e.title,
            body: e.body,
            createdAt: e.createdAt,
          }))
        : undefined,
    );

    if (
      pendingHealthEvents.length > 0 &&
      (uploadOk || !settings.healthAlerts)
    ) {
      await clearPendingHealthEvents();
    }

    const displayedIds = new Set(await getDisplayedEventIds());
    const events = await pullNotificationEvents();
    for (const event of events) {
      await recordNotificationEvent(event);
      const staleFired =
        (event.type === "price_drop" || event.type === "price_rise") &&
        event.alertId &&
        !activeAlertIds.has(event.alertId);
      if (!staleFired && !displayedIds.has(event.id)) {
        await scheduleServerEventNotification(event.title, event.body, {
          productId: event.productId,
        });
        await recordDisplayedEventId(event.id);
      }
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
  reminderId?: string;
  triggeredPrice?: number;
}): Promise<void> {
  const { deactivateAlert, removeStockWatch, removeBackOrderReminder } =
    await import("./storage");
  if (
    (event.type === "price_drop" || event.type === "price_rise") &&
    event.alertId
  ) {
    await deactivateAlert(event.alertId, event.triggeredPrice ?? 0);
  }
  if (event.type === "restock" && event.watchId) {
    await removeStockWatch(event.watchId);
  }
  if (event.type === "reminder" && event.reminderId) {
    await removeBackOrderReminder(event.reminderId);
  }
}

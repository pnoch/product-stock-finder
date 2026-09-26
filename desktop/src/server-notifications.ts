import { storage } from "./storage";
import { createTRPCClient } from "./lib/trpc";
import { resolveEventRoute } from "./lib/notification-routing";
import { unregisterServerToken, PENDING_UNREGISTER_KEY } from "./lib/push-unregister";
import { withTimeout } from "../../lib/with-timeout";
import {
  MAX_UPLOAD_ALERTS,
  MAX_UPLOAD_DATE_REMINDERS,
  MAX_UPLOAD_HEALTH_EVENTS,
  MAX_UPLOAD_STOCK_WATCHES,
} from "../../shared/const";

const TIMEOUT_MS = 4000;

interface PushConfig {
  alerts: Array<{
    id: string;
    productId: string;
    modelNumber?: string;
    targetPrice: number;
    currency: string;
    distributorId?: string;
    direction?: "drop" | "rise";
    snoozedUntil?: string;
  }>;
  stockWatches: Array<{
    id: string;
    productId: string;
    modelNumber?: string;
    distributorId: string;
    lastKnownStatus?: string;
  }>;
  dateReminders: Array<{
    id: string;
    productId: string;
    modelNumber?: string;
    distributorId: string;
    reminderDate: string;
  }>;
  /** `null` explicitly clears the setting; absent preserves it. */
  quietHours?: { start: string; end: string; utcOffsetMinutes?: number } | null;
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
  productId?: string;
  distributorId?: string;
  createdAt?: number;
}

async function uploadConfig(config: PushConfig): Promise<boolean> {
  try {
    const client = createTRPCClient();
    const result = await withTimeout(
      client.notifications.uploadConfig
        .mutate({ ...config })
        .then(() => true as const),
      TIMEOUT_MS,
    );
    return result === true;
  } catch {
    return false;
  }
}

async function pullEvents(): Promise<PushEvent[]> {
  try {
    const client = createTRPCClient();
    const result = await withTimeout(client.notifications.pull.query({}), TIMEOUT_MS);
    return result?.events ?? [];
  } catch {
    return [];
  }
}

async function reconcileEvent(event: PushEvent): Promise<void> {
  // Pass the event time so a stale event cannot re-deactivate a freshly
  // re-armed alert (mobile does the same).
  if (
    (event.type === "price_drop" || event.type === "price_rise") &&
    event.alertId
  ) {
    await storage.deactivateAlert(
      event.alertId,
      event.triggeredPrice ?? 0,
      event.createdAt,
    );
  }
  if (event.type === "restock" && event.watchId) {
    await storage.removeStockWatch(event.watchId);
  }
  if (event.type === "reminder" && event.reminderId) {
    await storage.removeBackOrderReminder(event.reminderId);
  }
}

let syncInFlight: Promise<void> | null = null;

export function syncDesktopNotifications(): Promise<void> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = runSyncDesktopNotifications().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

async function runSyncDesktopNotifications(): Promise<void> {
  try {
    const settings = await storage.getSettings();
    const pendingHealthEvents = await storage.getPendingHealthEvents();

    if (localStorage.getItem(PENDING_UNREGISTER_KEY) === "1") {
      const unregistered = await unregisterServerToken(createTRPCClient());
      if (unregistered) localStorage.removeItem(PENDING_UNREGISTER_KEY);
    }

    // Master switch off: retract the server-side config so evaluation stops,
    // drop the health buffer (intentional suppression, not loss), and skip
    // pulling/displaying events entirely.
    if (!settings.notificationsEnabled) {
      await uploadConfig({ alerts: [], stockWatches: [], dateReminders: [] });
      if (pendingHealthEvents.length > 0) {
        await storage.clearPendingHealthEvents();
      }
      return;
    }

    const alerts = await storage.getAlerts();
    // The server resolves prices by model number, but only knows the static
    // catalog. Send the model for every referenced product so manually added /
    // rediscovered products also get server-side notifications (mobile does the
    // same).
    const watchlist = await storage.getWatchlist();
    const modelByProductId = new Map(
      watchlist.map((p) => [p.id, p.modelNumber] as const),
    );
    const activeAlerts = settings.priceAlerts
      ? alerts
          .filter((a) => a.isActive && !a.triggeredAt)
          .map((a) => ({
            id: a.id,
            productId: a.productId,
            modelNumber: modelByProductId.get(a.productId),
            targetPrice: a.targetPrice,
            currency: a.currency,
            distributorId: a.distributorId,
            direction: a.direction,
            snoozedUntil: a.snoozedUntil,
          }))
      : [];
    const activeAlertIds = new Set(activeAlerts.map((a) => a.id));
    const stockWatches = settings.stockAlerts
      ? (await storage.getStockWatches()).map((w) => ({
          id: w.id,
          productId: w.productId,
          modelNumber: modelByProductId.get(w.productId),
          distributorId: w.distributorId,
          lastKnownStatus: w.lastKnownStatus,
        }))
      : [];
    const dateReminders = (await storage.getBackOrderReminders())
      .filter((r) => r.reminderType === "date")
      .map((r) => ({
        id: r.id,
        productId: r.productId,
        modelNumber: modelByProductId.get(r.productId),
        distributorId: r.distributorId,
        reminderDate: r.reminderDate,
      }));
    const healthEvents = pendingHealthEvents.map((e) => {
      const id = (e as unknown as { id?: unknown }).id;
      return {
        id: typeof id === "string" && id ? id : `health-${e.distributorId}-${e.status}-${e.createdAt}`,
        distributorId: e.distributorId,
        distributorName: e.distributorName,
        status: e.status,
        title: e.title,
        body: e.body,
        createdAt: e.createdAt,
      };
    });

    // Trim to the server's schema caps: sending more makes the whole upload
    // fail, silently disabling server-side notifications (mirrors mobile).
    const uploadOk = await uploadConfig({
      alerts: activeAlerts.slice(0, MAX_UPLOAD_ALERTS),
      stockWatches: stockWatches.slice(0, MAX_UPLOAD_STOCK_WATCHES),
      dateReminders: dateReminders.slice(0, MAX_UPLOAD_DATE_REMINDERS),
      quietHours: settings.quietHours
        ? {
            ...settings.quietHours,
            utcOffsetMinutes: new Date().getTimezoneOffset(),
          }
        : // Explicitly clear: an absent field would preserve a stale setting.
          null,
      healthEvents:
        settings.healthAlerts && healthEvents.length > 0
          ? healthEvents.slice(0, MAX_UPLOAD_HEALTH_EVENTS)
          : undefined,
    });
    if (uploadOk && pendingHealthEvents.length > 0) {
      await storage.clearPendingHealthEvents();
    }

    const events = await pullEvents();
    const { sendDesktopNotification } = await import("./notifications");
    const displayedIds = new Set(await storage.getDisplayedEventIds());
    for (const event of events) {
      try {
        // Both directions: a stale price_rise event for an inactive alert must
        // be skipped too (mobile checks both).
        const stalePriceEvent =
          (event.type === "price_drop" || event.type === "price_rise") &&
          event.alertId &&
          !activeAlertIds.has(event.alertId);
        if (!stalePriceEvent && !displayedIds.has(event.id)) {
          const route = resolveEventRoute(event, activeAlerts, stockWatches, dateReminders);
          // Only mark displayed when something was actually shown; otherwise the
          // event would be dropped forever even after permissions are granted.
          const shown = await sendDesktopNotification(event.title, event.body, route);
          if (shown) await storage.recordDisplayedEventId(event.id);
        }
        // Record in the in-app Notification Center too; without this server
        // events showed as OS toasts but the Alerts tab stayed empty.
        try {
          await storage.recordNotificationEvent({
            id: event.id,
            type: event.type as never,
            title: event.title,
            body: event.body,
            productId: event.productId,
            distributorId: event.distributorId,
            alertId: event.alertId,
            triggeredPrice: event.triggeredPrice,
            createdAt: event.createdAt ?? Date.now(),
          });
        } catch {
          // history recording is best-effort
        }
        // Skip reconciliation for an event already delivered in a previous sync:
        // a replay must not delete a watch/reminder the user re-created after
        // the first delivery (mobile does the same).
        if (!displayedIds.has(event.id)) {
          await reconcileEvent(event);
        }
      } catch {
        // skip this event; keep processing the rest
      }
    }
  } catch {
    // desktop notification sync is best-effort
  }
}

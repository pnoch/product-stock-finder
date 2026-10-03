import { createTRPCClient } from "./trpc";
import { withTimeout } from "./with-timeout";
import {
  MAX_UPLOAD_ALERTS,
  MAX_UPLOAD_DATE_REMINDERS,
  MAX_UPLOAD_HEALTH_EVENTS,
  MAX_UPLOAD_STOCK_WATCHES,
} from "../shared/const";
import type {
  NotificationConfig,
  NotificationEvent,
} from "../server/notifications";

const TIMEOUT_MS = 4000;

// Larger than the server's 5s webhook POST budget: a shorter client deadline
// reports a false failure while the send is still in flight.
const WEBHOOK_TEST_TIMEOUT_MS = 8_000;

export async function uploadNotificationConfig(
  config: NotificationConfig,
  healthEvents?: {
    id: string;
    distributorId: string;
    distributorName: string;
    status: "blocked" | "error";
    /** Separates an alert from its recovery in the server's health dedup key. */
    kind?: "alert" | "recovery";
    title: string;
    body: string;
    createdAt: number;
  }[],
): Promise<boolean> {
  try {
    const client = createTRPCClient();
    const result = await withTimeout(
      client.notifications.uploadConfig.mutate({
        ...config,
        healthEvents,
      }).then(() => true as const),
      TIMEOUT_MS,
    );
    return result === true;
  } catch {
    return false;
  }
}

// Serializes the read-modify-write below. A health sweep fires one upload per
// distributor without awaiting, so parallel calls all read the same base list
// and each wrote a list containing only its own event — dropping the rest.
let healthBufferQueue: Promise<unknown> = Promise.resolve();

export async function uploadHealthEventToServer(event: {
  id?: string;
  distributorId: string;
  distributorName: string;
  status: "blocked" | "error";
  kind?: "alert" | "recovery";
  title: string;
  body: string;
  createdAt: number;
}): Promise<void> {
  const run = async () => {
    const { getPendingHealthEvents, savePendingHealthEvents } = await import("./storage");
    const pending = await getPendingHealthEvents();
    pending.push(event);
    // Bound the buffer at the upload cap (keep the newest): it is persisted to
    // AsyncStorage, and the server rejects uploads larger than the cap — so an
    // uncapped buffer would grow forever and then fail to upload at all.
    const trimmed =
      pending.length > MAX_UPLOAD_HEALTH_EVENTS
        ? pending.slice(pending.length - MAX_UPLOAD_HEALTH_EVENTS)
        : pending;
    await savePendingHealthEvents(trimmed);
  };
  const next = healthBufferQueue.then(run, run);
  healthBufferQueue = next.catch(() => {});
  return next;
}

export async function pullNotificationEvents(): Promise<NotificationEvent[]> {
  try {
    const client = createTRPCClient();
    const result = await withTimeout(
      client.notifications.pull.query({}),
      TIMEOUT_MS,
    );
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
      getWatchlist,
      getDisplayedEventIds,
      recordDisplayedEventId,
      recordNotificationEvent,
    } = await import("./storage");
    const { scheduleServerEventNotification } = await import("./notifications");

    const {
      getPendingHealthEvents,
      clearPendingHealthEvents,
      savePendingHealthEvents,
    } = await import("./storage");
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
    // The server resolves prices by model number, but only knows the static
    // catalog. Send the model for every referenced product so manually added /
    // rediscovered products also get server-side notifications.
    const watchlist = await getWatchlist();
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
    const currentWatchIds = new Set((await getStockWatches()).map((w) => w.id));

    const stockWatches = settings.stockAlerts
      ? (await getStockWatches()).map((w) => ({
          id: w.id,
          productId: w.productId,
          modelNumber: modelByProductId.get(w.productId),
          distributorId: w.distributorId,
          lastKnownStatus: w.lastKnownStatus,
        }))
      : [];

    const dateReminders = (await getBackOrderReminders())
      .filter((r) => r.reminderType === "date")
      .map((r) => ({
        id: r.id,
        productId: r.productId,
        modelNumber: modelByProductId.get(r.productId),
        distributorId: r.distributorId,
        reminderDate: r.reminderDate,
      }));

    const uploadOk = await uploadNotificationConfig(
      {
        // Trim to the server's schema caps: sending more than the limit makes
        // the whole upload fail, silently disabling server-side notifications.
        alerts: activeAlerts.slice(0, MAX_UPLOAD_ALERTS),
        stockWatches: stockWatches.slice(0, MAX_UPLOAD_STOCK_WATCHES),
        dateReminders: dateReminders.slice(0, MAX_UPLOAD_DATE_REMINDERS),
        quietHours: settings.quietHours
          ? {
              ...settings.quietHours,
              // Send the device's UTC offset so the server evaluates quiet
              // hours in the user's timezone, not the server's.
              utcOffsetMinutes: new Date().getTimezoneOffset(),
            }
          : // Explicitly clear: an absent field would preserve a stale setting.
            null,
      },
      settings.healthAlerts && pendingHealthEvents.length > 0
        ? pendingHealthEvents
            // Keep the newest, matching the buffer's own cap: `slice(0, N)`
            // would upload the OLDEST events if a legacy store held an
            // over-cap array.
            .slice(-MAX_UPLOAD_HEALTH_EVENTS)
            .map((e) => ({
              // Prefer the id shared with the local notification event so the
              // server event dedupes against it; fall back to a derived id.
              id: e.id ?? `health-${e.distributorId}-${e.status}-${e.createdAt}`,
              distributorId: e.distributorId,
              distributorName: e.distributorName,
              status: e.status,
              // Without `kind` the server keyed a recovery identically to its
              // alert in the same hour bucket and silently dropped it.
              kind: e.kind,
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
      // A health sweep can append while the upload is in flight; clearing the
      // whole key discarded those un-uploaded events (other devices never got
      // them). Keep whatever arrived after the snapshot.
      const remaining = await getPendingHealthEvents();
      const uploaded = new Set(pendingHealthEvents.map((e) => e.id));
      const arrived = remaining.filter((e) => !uploaded.has(e.id));
      if (arrived.length > 0) {
        await savePendingHealthEvents(arrived);
      } else {
        await clearPendingHealthEvents();
      }
    }

    const displayedIds = new Set(await getDisplayedEventIds());
    const events = await pullNotificationEvents();
    for (const event of events) {
      const staleFired =
        ((event.type === "price_drop" || event.type === "price_rise") &&
          event.alertId &&
          !activeAlertIds.has(event.alertId)) ||
        // The client's own check may have fired and removed the watch already;
        // the server still holds the uploaded config and sends its own restock
        // event for the same restock, which would double-notify (the price path
        // is guarded the same way).
        (event.type === "restock" &&
          Boolean(event.watchId) &&
          !currentWatchIds.has(event.watchId!));
      // Only record what we did not already handle locally: a locally-fired
      // price drop/restock has a different id, so recording the server's copy
      // too put two unread entries (and a doubled badge) in the Notification
      // Center for one event.
      if (!staleFired) {
        await recordNotificationEvent(event);
      }
      if (!staleFired && !displayedIds.has(event.id)) {
        // Only mark displayed when something was actually shown; otherwise the
        // event would be dropped forever even after permissions are granted.
        // Carry the real event type: without it the locally-shown copy is
        // tagged "server_event" and cannot route to /stats (digest) or /health
        // on tap, unlike the push copy which keeps the type.
        const shown = await scheduleServerEventNotification(
          event.title,
          event.body,
          { productId: event.productId, type: event.type },
        );
        if (shown) await recordDisplayedEventId(event.id);
      }
      // Skip reconciliation for an event already delivered in a previous sync:
      // a replay must not delete a watch/reminder the user re-created after the
      // first delivery (stock-watch ids are deterministic).
      if (!displayedIds.has(event.id)) {
        await reconcileEvent(event);
      }
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
  createdAt?: number;
}): Promise<void> {
  const { deactivateAlert, removeStockWatch, removeBackOrderReminder } =
    await import("./storage");
  if (
    (event.type === "price_drop" || event.type === "price_rise") &&
    event.alertId
  ) {
    // Pass the event time so a stale event cannot re-deactivate a re-armed alert.
    await deactivateAlert(event.alertId, event.triggeredPrice ?? 0, event.createdAt);
  }
  if (event.type === "restock" && event.watchId) {
    await removeStockWatch(event.watchId);
  }
  if (event.type === "reminder" && event.reminderId) {
    await removeBackOrderReminder(event.reminderId);
  }
}

export async function testWebhook(
  url: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = createTRPCClient();
    // withTimeout resolves null on timeout, so coalesce it into a failure result
    // (null would otherwise be an invalid return for this function).
    return (
      (await withTimeout(
        client.notifications.testWebhook.mutate({ url }),
        WEBHOOK_TEST_TIMEOUT_MS,
      )) ?? { ok: false, error: "Could not reach the server. Try again." }
    );
  } catch {
    return { ok: false, error: "Could not reach the server. Try again." };
  }
}

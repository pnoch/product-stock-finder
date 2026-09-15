import type { EventDraft, NotificationConfig, NotificationEvent } from "./types";

export function rowToConfig(row: {
  alerts: unknown;
  stockWatches: unknown;
  dateReminders: unknown;
  quietHours?: unknown;
}): NotificationConfig {
  const quietHours = row.quietHours as
    | { start?: unknown; end?: unknown; utcOffsetMinutes?: unknown }
    | null
    | undefined;
  return {
    alerts: (row.alerts as NotificationConfig["alerts"]) ?? [],
    stockWatches:
      (row.stockWatches as NotificationConfig["stockWatches"]) ?? [],
    dateReminders:
      (row.dateReminders as NotificationConfig["dateReminders"]) ?? [],
    ...(typeof quietHours?.start === "string" &&
    typeof quietHours?.end === "string"
      ? {
          quietHours: {
            start: quietHours.start,
            end: quietHours.end,
            // Preserve the client's UTC offset; dropping it made the server
            // evaluate quiet hours in the server process timezone.
            ...(typeof quietHours.utcOffsetMinutes === "number"
              ? { utcOffsetMinutes: quietHours.utcOffsetMinutes }
              : {}),
          },
        }
      : {}),
  };
}

export function draftToEvent(draft: EventDraft): NotificationEvent {
  const payload = (draft.payload ?? {}) as Record<string, unknown>;
  return {
    id: draft.id,
    type: draft.type as NotificationEvent["type"],
    title: draft.title,
    body: draft.body,
    alertId: payload.alertId as string | undefined,
    watchId: payload.watchId as string | undefined,
    reminderId: payload.reminderId as string | undefined,
    productId: payload.productId as string,
    distributorId: payload.distributorId as string | undefined,
    targetPrice: payload.targetPrice as number | undefined,
    currency: payload.currency as string | undefined,
    triggeredPrice: payload.triggeredPrice as number | undefined,
    createdAt: draft.createdAt,
  };
}

export function rowToEvent(row: {
  id: string;
  type: string;
  title: string;
  body: string;
  payload: unknown;
  createdAt: number;
}): NotificationEvent {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    type: row.type as NotificationEvent["type"],
    title: row.title,
    body: row.body,
    alertId: payload.alertId as string | undefined,
    watchId: payload.watchId as string | undefined,
    reminderId: payload.reminderId as string | undefined,
    productId: payload.productId as string,
    distributorId: payload.distributorId as string | undefined,
    targetPrice: payload.targetPrice as number | undefined,
    currency: payload.currency as string | undefined,
    triggeredPrice: payload.triggeredPrice as number | undefined,
    createdAt: row.createdAt,
  };
}

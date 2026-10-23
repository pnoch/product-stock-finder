import { z } from "zod";
import type { EventDraft, NotificationConfig, NotificationEvent } from "./types";

const alertSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  modelNumber: z.string().optional(),
  targetPrice: z.number(),
  currency: z.string().min(1),
  distributorId: z.string().optional(),
  direction: z.enum(["drop", "rise"]).optional(),
  snoozedUntil: z.string().optional(),
});

const stockWatchSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  modelNumber: z.string().optional(),
  distributorId: z.string().min(1),
  scope: z.enum(["distributor", "any"]).optional(),
  lastKnownStatus: z.string().optional(),
  lastKnownStatusByDistributor: z.record(z.string(), z.string()).optional(),
});

const dateReminderSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  modelNumber: z.string().optional(),
  distributorId: z.string().min(1),
  reminderDate: z.string(),
});

// A malformed row (hand-edited JSON, an older client, a partial write) must not
// crash the whole evaluation tick. Drop only the invalid entries.
function parseArray<T>(schema: z.ZodType<T>, value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const entry of value) {
    const parsed = schema.safeParse(entry);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}

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
    alerts: parseArray(alertSchema, row.alerts),
    stockWatches: parseArray(stockWatchSchema, row.stockWatches),
    dateReminders: parseArray(dateReminderSchema, row.dateReminders),
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

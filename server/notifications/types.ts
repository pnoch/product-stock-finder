import type { InsertNotificationEventRow } from "../../drizzle/schema";

export interface NotificationConfig {
  alerts: Array<{
    id: string;
    productId: string;
    /** Model number for products outside the static catalog. */
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
  healthEvents?: Array<{
    id: string;
    distributorId: string;
    distributorName: string;
    status: "blocked" | "error";
    // Distinguishes a failure alert from a recovery. Both carry the same
    // `status`, so without this they dedupe to the same key within an hour and
    // the recovery is silently dropped.
    kind?: "alert" | "recovery";
    title: string;
    body: string;
    createdAt: number;
  }>;
  // Quiet-hours digest batching: when set and covering now, the warmer holds
  // fresh events and flushes one grouped digest at the window end instead of
  // pushing immediately. Evaluated in server-local time.
  quietHours?: { start: string; end: string; utcOffsetMinutes?: number };
}

export interface NotificationEvent {
  id: string;
  type: "price_drop" | "price_rise" | "restock" | "reminder" | "digest";
  title: string;
  body: string;
  alertId?: string;
  watchId?: string;
  reminderId?: string;
  productId: string;
  distributorId?: string;
  targetPrice?: number;
  currency?: string;
  triggeredPrice?: number;
  createdAt: number;
}

export interface MemoryEvent extends NotificationEvent {
  userId: number | null;
  deviceId: string | null;
  dedupKey?: string;
}

export interface EventDraft extends Omit<
  InsertNotificationEventRow,
  "deviceId" | "userId"
> {
  dedupKey: string;
}

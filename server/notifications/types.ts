import type { InsertNotificationEventRow } from "../../drizzle/schema";

export interface NotificationConfig {
  alerts: Array<{
    id: string;
    productId: string;
    targetPrice: number;
    currency: string;
    distributorId?: string;
    direction?: "drop" | "rise";
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

export interface NotificationEvent {
  id: string;
  type: "price_drop" | "price_rise" | "restock" | "reminder";
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

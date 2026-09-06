import { PRODUCT_CATALOG } from "../../shared/src/catalog.js";
import { getDistributorById } from "../../shared/src/distributors.js";
import { getAllParserIds } from "../../lib/scrapers/registry";
import { getCachedPrice } from "../price-cache";
import { formatPrice } from "../../shared/src/currency.js";
import { convertPrice } from "../../lib/currency";
import type {
  EventDraft,
  NotificationConfig,
  NotificationEvent,
} from "./types";

export function newEventId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function dedupKeyForHealth(event: {
  distributorId: string;
  status: string;
  createdAt: number;
}): string {
  return `health:${event.distributorId}:${event.status}:${event.createdAt}`;
}

export function dedupKeyFor(event: NotificationEvent): string {
  if (event.type === "price_drop") return `price_drop:${event.alertId}`;
  if (event.type === "price_rise") return `price_rise:${event.alertId}`;
  if (event.type === "restock")
    return `restock:${event.productId}:${event.distributorId}`;
  return `reminder:${event.reminderId}`;
}

export async function buildEvents(
  config: NotificationConfig,
  now: number,
): Promise<EventDraft[]> {
  const events: EventDraft[] = [];

  for (const alert of config.alerts) {
    const product = PRODUCT_CATALOG.find((p) => p.id === alert.productId);
    if (!product) continue;
    if (alert.snoozedUntil && new Date(alert.snoozedUntil).getTime() > now) {
      continue;
    }
    const distributorIds = alert.distributorId
      ? [alert.distributorId]
      : getAllParserIds();
    let bestPrice: number | null = null;
    let bestDistributor: string | null = null;
    for (const distributorId of distributorIds) {
      const snapshot = await getCachedPrice(distributorId, product.modelNumber);
      if (!snapshot || snapshot.stockStatus !== "in_stock") continue;
      const converted = convertPrice(
        snapshot.price,
        snapshot.currency,
        alert.currency,
      );
      if (converted === null) continue;
      if (bestPrice === null || converted < bestPrice) {
        bestPrice = converted;
        bestDistributor = distributorId;
      }
    }
    const isRise = alert.direction === "rise";
    if (isRise) {
      if (bestPrice === null || bestPrice < alert.targetPrice) continue;
    } else {
      if (bestPrice === null || bestPrice > alert.targetPrice) continue;
    }
    events.push({
      id: newEventId(),
      type: isRise ? "price_rise" : "price_drop",
      dedupKey: `${isRise ? "price_rise" : "price_drop"}:${alert.id}`,
      title: isRise ? "📈 Price Increase Alert!" : "💸 Price Drop Alert!",
      body: `${product.name} is now ${formatPrice(bestPrice, alert.currency)} — ${
        isRise ? "above" : "below"
      } your target of ${formatPrice(alert.targetPrice, alert.currency)}!`,
      payload: {
        alertId: alert.id,
        productId: alert.productId,
        distributorId: bestDistributor,
        targetPrice: alert.targetPrice,
        currency: alert.currency,
        triggeredPrice: bestPrice,
      },
      createdAt: now,
    });
  }

  for (const watch of config.stockWatches) {
    const product = PRODUCT_CATALOG.find((p) => p.id === watch.productId);
    if (!product) continue;
    if (watch.lastKnownStatus === "in_stock") continue;
    const snapshot = await getCachedPrice(
      watch.distributorId,
      product.modelNumber,
    );
    if (!snapshot || snapshot.stockStatus !== "in_stock") continue;
    const distributorName =
      getDistributorById(watch.distributorId)?.name ?? watch.distributorId;
    events.push({
      id: newEventId(),
      type: "restock",
      dedupKey: `restock:${watch.productId}:${watch.distributorId}`,
      title: "🟢 Back In Stock!",
      body: `${product.name} is now available at ${distributorName}.`,
      payload: {
        watchId: watch.id,
        productId: watch.productId,
        distributorId: watch.distributorId,
      },
      createdAt: now,
    });
  }

  for (const reminder of config.dateReminders) {
    const product = PRODUCT_CATALOG.find((p) => p.id === reminder.productId);
    if (!product) continue;
    if (now < new Date(reminder.reminderDate).getTime()) continue;
    const distributorName =
      getDistributorById(reminder.distributorId)?.name ??
      reminder.distributorId;
    events.push({
      id: newEventId(),
      type: "reminder",
      dedupKey: `reminder:${reminder.id}`,
      title: "📦 Back-Order Reminder",
      body: `Check ${distributorName} for ${product.name} — your reminder date is here!`,
      payload: {
        reminderId: reminder.id,
        productId: reminder.productId,
        distributorId: reminder.distributorId,
      },
      createdAt: now,
    });
  }

  return events;
}

import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { formatPrice } from "@shared/currency";
import { convertPrice } from "../currency";
import {
  ensureNotificationPermission,
  immediateTrigger,
} from "../notifications";
import {
  deactivateAlert,
  getAlerts,
  getWatchlist,
  rearmAlert,
} from "../storage";
import { listingsForAlert } from "../alert-scope";
import { checkPriceAnomaly } from "../alert-integrity";
import { mergedPoints } from "../product-insights";
import { isAcquired } from "../acquired";
import { isAutomaticProduct } from "../marketplace";
import { track } from "../telemetry";
import type { AppSettings } from "../types";

/** Checks active price alerts against freshly scraped prices. */
export async function evaluatePriceAlerts(
  settings: AppSettings,
): Promise<void> {
if (!settings.notificationsEnabled || !settings.priceAlerts) return;

const alerts = await getAlerts();
const now = Date.now();
const activeAlerts = alerts.filter(
  (a) =>
    a.isActive &&
    !a.triggeredAt &&
    (!a.snoozedUntil || new Date(a.snoozedUntil).getTime() <= now),
);
if (activeAlerts.length === 0) return;

const refreshedWatchlist = await getWatchlist();

for (const alert of activeAlerts) {
  const product = refreshedWatchlist.find((p) => p.id === alert.productId);
  if (!product?.listings?.length) continue;
  if (isAcquired(product) || !isAutomaticProduct(product)) continue;

  const eligibleListings = listingsForAlert(
    product.listings,
    alert.distributorId,
  );
  const inStockListings = eligibleListings.filter(
    (l) =>
      l.stockStatus === "in_stock" &&
      l.price > 0 &&
      Number.isFinite(l.price),
  );
  if (inStockListings.length === 0) continue;

  // Find the best (cheapest) in-stock price converted to alert currency
  const bestPrice = inStockListings.reduce((best, l) => {
    const converted = convertPrice(l.price, l.currency, alert.currency);
    if (converted === null) return best;
    return converted < best ? converted : best;
  }, Infinity);
  if (!Number.isFinite(bestPrice)) continue;

  const isRise = alert.direction === "rise";
  const triggered = isRise
    ? bestPrice >= alert.targetPrice
    : bestPrice <= alert.targetPrice;
  if (triggered) {
    // Only guard a price that would actually fire: a far-outlier that never
    // crossed target is not a "suppressed alert" and must not write a history
    // row. Scope the history to the alert's own listings so the client and the
    // server (which reads the alert's distributors) judge the same band.
    const history = mergedPoints(eligibleListings, alert.currency).map((p) => p.v);
    const anomaly = checkPriceAnomaly(bestPrice, history);
    if (anomaly.suspicious) {
      // A likely misparse: do NOT fire, do NOT deactivate — leave the alert
      // armed so a transient bad scrape doesn't kill a real alert. Record it so
      // the suppression is observable.
      try {
        const { recordNotificationEvent } = await import("../storage");
        await recordNotificationEvent({
          id: `local-suspicious-${alert.id}-${new Date().toISOString().slice(0, 10)}`,
          type: "suspicious_price",
          title: "Suspicious price ignored",
          body: `${product.name} showed ${formatPrice(bestPrice, alert.currency)} — far from its usual price. Alert kept armed.`,
          alertId: alert.id,
          productId: alert.productId,
          triggeredPrice: bestPrice,
          currency: alert.currency,
          createdAt: Date.now(),
        });
      } catch {
        // history recording never breaks the check
      }
      track("alert_suppressed", { reason: anomaly.reason });
      continue;
    }
    // Re-read alerts to avoid duplicate fire
    const currentAlerts = await getAlerts();
    const current = currentAlerts.find((a) => a.id === alert.id);
    if (current?.triggeredAt) continue;
    // Price crossed target — fire notification and deactivate alert.
    // ensureNotificationPermission handles the web Notification API.
    const granted = await ensureNotificationPermission();
    if (!granted) continue;
    // Claim the transition first: a concurrent runner (foreground check
    // vs background task) that already triggered this alert makes
    // deactivateAlert return false, in which case we must not notify.
    if (!(await deactivateAlert(alert.id, bestPrice))) continue;
    try {
      const title = isRise ? "Price Increase Alert!" : "Price Drop Alert!";
      const body = `${product.name} is now ${formatPrice(bestPrice, alert.currency)} — ${
        isRise ? "above" : "below"
      } your target of ${formatPrice(alert.targetPrice, alert.currency)}!`;
      if (Platform.OS === "web") {
        const { displayWebNotification } = await import("../web-notifications");
        // The alert is already claimed; if the notification cannot be shown
        // (permission revoked since the gate), throw so the catch re-arms it
        // instead of consuming it silently. Mirrors the restock path.
        if (!displayWebNotification(title, body)) {
          throw new Error("notification could not be displayed");
        }
      } else {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: true,
          },
          trigger: immediateTrigger("price"),
        });
      }
      // Record locally-fired alerts in the in-app history too; otherwise the
      // Notification Center only shows server events and the counts diverge.
      try {
        const { recordNotificationEvent } = await import("../storage");
        await recordNotificationEvent({
          id: `local-price-${alert.id}-${Date.now()}`,
          type: isRise ? "price_rise" : "price_drop",
          title,
          body,
          alertId: alert.id,
          productId: alert.productId,
          triggeredPrice: bestPrice,
          currency: alert.currency,
          createdAt: Date.now(),
        });
      } catch {
        // history recording never breaks the check
      }
    } catch {
      // Scheduling failed after a successful claim: re-arm so a later run
      // retries instead of dropping the alert silently. Safe from
      // double-fire — only the claiming runner can re-arm this path.
      await rearmAlert(alert.id);
    }
  }
}
}

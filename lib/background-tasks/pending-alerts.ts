import {
  addAlert,
  getAlerts,
  getSettings,
  getWatchlist,
  updateSettings,
} from "../storage";
import { fulfillPendingAlerts } from "../concierge";
import { isAutomaticProduct } from "../marketplace";

/**
 * Fulfills concierge pending alerts. Storage writes only — no notification
 * permission needed. Best-effort: a failure must never break the price check.
 */
export async function fulfillConciergePendingAlerts(): Promise<void> {
  try {
    const settings = await getSettings().catch(() => null);
    const pending = settings?.pendingAlertProductIds ?? [];
    if (pending.length === 0) return;

    const products = (await getWatchlist().catch(() => [])).filter(
      isAutomaticProduct,
    );
    const displayCurrency = settings?.displayCurrency ?? "USD";
    const { alertsToCreate, remainingIds } = fulfillPendingAlerts(
      products,
      pending,
      displayCurrency,
    );
    const existing = await getAlerts().catch(() => []);
    for (const alert of alertsToCreate) {
      // Skip if the user already created an alert for this product meanwhile.
      if (
        existing.some(
          (e) => e.productId === alert.productId && e.isActive,
        )
      ) {
        continue;
      }
      await addAlert({
        id: `alert-${alert.productId}-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 6)}`,
        productId: alert.productId,
        targetPrice: alert.targetPrice,
        currency: alert.currency,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
    }
    await updateSettings({ pendingAlertProductIds: remainingIds }).catch(
      () => {},
    );
  } catch {
    // best-effort
  }
}

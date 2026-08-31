// Price alerts may be scoped to a single distributor; evaluation must only
// consider that distributor's listings.
import type { PriceAlert } from "./types";
import { convertPrice, hasExchangeRate } from "./currency";

export function listingsForAlert<
  T extends { distributorId: string },
>(listings: T[], distributorId?: string): T[] {
  if (!distributorId) return listings;
  return listings.filter((l) => l.distributorId === distributorId);
}

export function alertDeltaPct(
  listing: { price: number; currency: string },
  alert: Pick<PriceAlert, "targetPrice" | "currency"> | null,
): number | null {
  if (!alert || alert.targetPrice <= 0) return null;
  if (!hasExchangeRate(listing.currency) || !hasExchangeRate(alert.currency)) {
    return null;
  }
  const converted = convertPrice(
    listing.price,
    listing.currency,
    alert.currency,
  );
  if (converted === null) return null;
  return Math.round(((converted - alert.targetPrice) / alert.targetPrice) * 100);
}

export function scopedAlertFor(
  alerts: PriceAlert[],
  productId: string,
  distributorId: string,
): PriceAlert | null {
  const match = alerts.find(
    (a) =>
      a.productId === productId &&
      a.distributorId === distributorId &&
      a.isActive &&
      !a.triggeredAt,
  );
  return match ?? null;
}

export function productWideAlert(
  alerts: PriceAlert[],
  productId: string,
): PriceAlert | null {
  const match = alerts.find(
    (a) =>
      a.productId === productId &&
      !a.distributorId &&
      a.isActive &&
      !a.triggeredAt,
  );
  return match ?? null;
}

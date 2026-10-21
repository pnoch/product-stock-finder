import type { Product, StockStatus } from "../../../lib/types";

export function getTrend(product: Product): "up" | "down" | "flat" {
  const listings = (product.listings ?? []).filter(
    (l) => (l.priceHistory ?? []).length >= 2,
  );
  if (!listings.length) return "flat";

  let totalPct = 0;
  let count = 0;
  for (const listing of listings) {
    // Sort by parsed time: the trend reads positionally (newest last), and a
    // history restored from a backup or a server pull is not guaranteed
    // ascending — an unsorted history reported "up" for a dropping price.
    const history = [...(listing.priceHistory ?? [])].sort(
      (a, b) => Date.parse(a.date) - Date.parse(b.date),
    );
    const recent = history[history.length - 1].price;
    const older = history[Math.max(0, history.length - 3)].price;
    if (!Number.isFinite(recent) || !Number.isFinite(older) || older <= 0)
      continue;
    totalPct += ((recent - older) / older) * 100;
    count += 1;
  }
  if (count === 0) return "flat";
  const avgPct = totalPct / count;
  if (avgPct > 1) return "up";
  if (avgPct < -1) return "down";
  return "flat";
}

export function getDominantStatus(product: Product): StockStatus {
  const statuses = (product.listings ?? []).map((l) => l.stockStatus);
  if (statuses.includes("in_stock")) return "in_stock";
  if (statuses.includes("back_order")) return "back_order";
  if (statuses.includes("out_of_stock")) return "out_of_stock";
  return "unknown";
}

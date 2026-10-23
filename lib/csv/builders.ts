import type { PricePoint, Product } from "../types";
import type { DistributorAnalysis } from "../distributor-analysis";
import { formatPrice } from "@shared/currency";
import { getBestPrice } from "../currency";
import { getDistributorById } from "@shared/distributors";
import {
  HISTORY_HEADER,
  LISTINGS_HEADER,
  SUMMARY_HEADER,
  escapeCsv,
} from "./shared";

function resolveStockStatus(product: Product): string {
  const listings = product.listings ?? [];
  if (listings.length === 0) return "unknown";
  let hasInStock = false;
  let hasBackOrder = false;
  let hasOutOfStock = false;
  for (const l of listings) {
    if (l.stockStatus === "in_stock") hasInStock = true;
    else if (l.stockStatus === "back_order") hasBackOrder = true;
    else if (l.stockStatus === "out_of_stock") hasOutOfStock = true;
  }
  if (hasInStock) return "in_stock";
  if (hasBackOrder) return "back_order";
  if (hasOutOfStock) return "out_of_stock";
  return "unknown";
}

export function watchlistToCsv(products: Product[], currency: string): string {
  const lines: string[] = [SUMMARY_HEADER];
  for (const p of products) {
    const best = getBestPrice(p.listings ?? [], currency);
    const bestPrice = best ? formatPrice(best.price, currency) : "";
    const status = resolveStockStatus(p);
    const row = [
      escapeCsv(p.name ?? ""),
      escapeCsv(p.modelNumber ?? ""),
      escapeCsv(p.brand ?? ""),
      escapeCsv(p.category ?? ""),
      escapeCsv(bestPrice),
      escapeCsv(status),
    ].join(",");
    lines.push(row);
  }
  return lines.join("\n");
}

export function watchlistToDetailedCsv(
  products: Product[],
  opts?: { shareUrl?: string },
): string {
  const lines: string[] = [];
  if (opts?.shareUrl) lines.push(`# Share: ${opts.shareUrl}`);
  lines.push(LISTINGS_HEADER);
  for (const p of products) {
    const listings = p.listings ?? [];
    if (listings.length === 0) {
      const row = [
        escapeCsv(p.name ?? ""),
        escapeCsv(p.modelNumber ?? ""),
        escapeCsv(p.brand ?? ""),
        escapeCsv(p.category ?? ""),
        escapeCsv(""),
        escapeCsv(""),
        escapeCsv(""),
        escapeCsv("unknown"),
        escapeCsv(""),
      ].join(",");
      lines.push(row);
      continue;
    }
    for (const l of listings) {
      const row = [
        escapeCsv(p.name ?? ""),
        escapeCsv(p.modelNumber ?? ""),
        escapeCsv(p.brand ?? ""),
        escapeCsv(p.category ?? ""),
        escapeCsv(l.distributorId ?? ""),
        // `l.price ? ...` treated a 0 price as missing; use a nullish check so
        // a genuine 0 is exported (matching priceHistoryToCsv).
        escapeCsv(typeof l.price === "number" ? String(l.price) : ""),
        escapeCsv(l.currency ?? ""),
        escapeCsv(l.stockStatus ?? "unknown"),
        escapeCsv(l.url ?? ""),
      ].join(",");
      lines.push(row);
    }
  }
  return lines.join("\n");
}

// ─── Distributor analysis export ────────────────────────────────────────────
// The analysis screen ranks distributors by coverage/average price, so its CSV
// must carry those columns — not the per-listing watchlist rows (which is what
// the screen used to export under a "distributor-analysis" filename).
export function distributorAnalysisToCsv(
  analysis: DistributorAnalysis[],
  displayCurrency: string,
): string {
  const header = "distributor,country,coverage,avgPrice,totalCost,currency";
  const lines = [header];
  for (const a of analysis) {
    const distributor = getDistributorById(a.distributorId);
    lines.push(
      [
        escapeCsv(distributor?.name ?? a.distributorId),
        escapeCsv(distributor?.countryCode ?? ""),
        String(a.coverage),
        a.averagePrice.toFixed(2),
        a.totalCost.toFixed(2),
        escapeCsv(displayCurrency),
      ].join(","),
    );
  }
  return lines.join("\n");
}

// A price point tagged with the distributor it came from. Multi-distributor
// exports (Compare, per-product history) flatten several listings' histories
// into one file, so without the tag the rows are unattributable.
export type TaggedPricePoint = PricePoint & { distributor?: string };

export function priceHistoryToCsv(
  history: TaggedPricePoint[],
  product: Pick<Product, "name" | "modelNumber">,
): string {
  const lines: string[] = [HISTORY_HEADER];
  for (const pt of history) {
    const row = [
      escapeCsv(product.name ?? ""),
      escapeCsv(product.modelNumber ?? ""),
      escapeCsv(pt.distributor ?? ""),
      escapeCsv(pt.date ?? ""),
      escapeCsv(String(pt.price ?? "")),
      escapeCsv(pt.currency ?? ""),
      escapeCsv(pt.stockStatus ?? "unknown"),
    ].join(",");
    lines.push(row);
  }
  return lines.join("\n");
}

// ─── Per-product history export with fallback ───────────────────────────────
export function productHistoryToCsv(product: Product): string {
  const allHistory: TaggedPricePoint[] = (product.listings ?? []).flatMap((l) =>
    (l.priceHistory ?? []).map((pt) => ({
      ...pt,
      distributor: getDistributorById(l.distributorId)?.name ?? l.distributorId,
    })),
  );
  if (allHistory.length > 0) {
    const sorted = [...allHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return priceHistoryToCsv(sorted, { name: product.name, modelNumber: product.modelNumber });
  }
  const fallback: TaggedPricePoint[] = (product.listings ?? [])
    .filter((l) => typeof l.price === "number" && Number.isFinite(l.price))
    .map((l) => ({
      date: l.lastChecked ?? new Date().toISOString().slice(0, 10),
      price: l.price,
      currency: l.currency ?? "USD",
      stockStatus: l.stockStatus ?? "unknown",
      distributor: getDistributorById(l.distributorId)?.name ?? l.distributorId,
    }));
  return priceHistoryToCsv(fallback, { name: product.name, modelNumber: product.modelNumber });
}

// ─── Export eligibility ─────────────────────────────────────────────────────
/**
 * True when a product has price history or at least one finite listing price
 * (0 counts). Decides whether a Product Detail CSV export is useful.
 */
export function hasExportablePriceData(product: Product): boolean {
  return (product.listings ?? []).some(
    (l) =>
      (l.priceHistory?.length ?? 0) > 0 ||
      (typeof l.price === "number" && Number.isFinite(l.price)),
  );
}


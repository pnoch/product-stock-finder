import type {
  Product,
  StockStatus,
  TagDefinition,
  WatchlistGroup,
  WatchlistSort,
} from "./types";
import { convertPrice, getBestPrice } from "./currency";
import { getDistributorById } from "./distributors";
import { productHasRegion } from "./region-filter";
import { matchesTagFilterMode } from "./tags";

export type { WatchlistGroup, WatchlistSort };

export type StatusFilter = "all" | StockStatus;

export interface WatchlistFilters {
  region: string;
  tagIds: string[];
  tagMatchMode: "any" | "all";
  status: StatusFilter;
  query: string;
}

export interface WatchlistSection {
  key: string;
  title: string;
  products: Product[];
}

export const SORT_OPTIONS: { key: WatchlistSort; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "best_price", label: "Best Price" },
  { key: "az", label: "A–Z" },
  { key: "price_drop", label: "Price Drop" },
  { key: "status", label: "Status" },
  { key: "region", label: "Region" },
];

export const GROUP_OPTIONS: { key: WatchlistGroup; label: string }[] = [
  { key: "off", label: "Off" },
  { key: "tag", label: "Tag" },
  { key: "status", label: "Status" },
  { key: "region", label: "Region" },
];

export const STATUS_LABELS: Record<StockStatus, string> = {
  in_stock: "In Stock",
  back_order: "Back Order",
  out_of_stock: "Out of Stock",
  unknown: "Unknown",
};

const STATUS_ORDER: StockStatus[] = [
  "in_stock",
  "back_order",
  "out_of_stock",
  "unknown",
];

export function productStatus(product: Product): StockStatus {
  const listings = product.listings ?? [];
  if (listings.some((l) => l.stockStatus === "in_stock")) return "in_stock";
  if (listings.some((l) => l.stockStatus === "back_order")) return "back_order";
  if (listings.some((l) => l.stockStatus === "out_of_stock"))
    return "out_of_stock";
  return "unknown";
}

export function productRegion(product: Product): string {
  const first = (product.listings ?? [])[0];
  if (!first) return "Unknown";
  return getDistributorById(first.distributorId)?.region ?? "Unknown";
}

export function priceDropPercent(product: Product): number | null {
  const best = getBestPrice(product.listings ?? [], "USD");
  if (!best || best.price <= 0) return null;
  const history = (product.listings ?? []).flatMap((l) => l.priceHistory ?? []);
  let max = 0;
  for (const point of history) {
    const usd = convertPrice(point.price, point.currency, "USD");
    if (usd > max) max = usd;
  }
  if (max <= 0) return null;
  return ((max - best.price) / max) * 100;
}

export function filterWatchlist(
  list: Product[],
  filters: WatchlistFilters,
): Product[] {
  const q = filters.query.trim().toLowerCase();
  return list.filter((p) => {
    if (filters.region !== "all" && !productHasRegion(p, filters.region))
      return false;
    if (!matchesTagFilterMode(p, filters.tagIds, filters.tagMatchMode))
      return false;
    if (filters.status !== "all" && productStatus(p) !== filters.status)
      return false;
    if (
      q &&
      !p.name.toLowerCase().includes(q) &&
      !p.modelNumber.toLowerCase().includes(q)
    )
      return false;
    return true;
  });
}

export function countTagMatches(
  list: Product[],
  filters: Pick<WatchlistFilters, "region" | "status" | "query">,
): Record<string, number> {
  const q = filters.query.trim().toLowerCase();
  const counts: Record<string, number> = {};
  for (const p of list) {
    if (filters.region !== "all" && !productHasRegion(p, filters.region))
      continue;
    if (filters.status !== "all" && productStatus(p) !== filters.status)
      continue;
    if (
      q &&
      !p.name.toLowerCase().includes(q) &&
      !p.modelNumber.toLowerCase().includes(q)
    )
      continue;
    for (const tagId of p.tags ?? []) {
      counts[tagId] = (counts[tagId] ?? 0) + 1;
    }
  }
  return counts;
}

export function sortWatchlist(
  list: Product[],
  sort: WatchlistSort,
): Product[] {
  const copy = [...list];
  switch (sort) {
    case "recent":
      return copy.sort(
        (a, b) =>
          new Date(b.addedAt ?? 0).getTime() -
          new Date(a.addedAt ?? 0).getTime(),
      );
    case "az":
      return copy.sort(
        (a, b) =>
          a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
      );
    case "best_price":
      return copy.sort((a, b) => {
        const pa = getBestPrice(a.listings ?? [], "USD")?.price ?? Infinity;
        const pb = getBestPrice(b.listings ?? [], "USD")?.price ?? Infinity;
        return pa - pb;
      });
    case "price_drop":
      return copy.sort((a, b) => {
        const da = priceDropPercent(a) ?? -Infinity;
        const db = priceDropPercent(b) ?? -Infinity;
        return db - da;
      });
    case "status":
      return copy.sort(
        (a, b) =>
          STATUS_ORDER.indexOf(productStatus(a)) -
          STATUS_ORDER.indexOf(productStatus(b)),
      );
    case "region":
      return copy.sort((a, b) => productRegion(a).localeCompare(productRegion(b)));
    default:
      return copy;
  }
}

export function groupWatchlist(
  list: Product[],
  group: WatchlistGroup,
  tagDefinitions: Record<string, TagDefinition>,
): WatchlistSection[] {
  if (list.length === 0) return [];
  if (group === "off") return [{ key: "all", title: "All", products: list }];
  if (group === "tag") {
    const sections: WatchlistSection[] = Object.values(tagDefinitions).map(
      (tag) => ({
        key: `tag-${tag.id}`,
        title: tag.name,
        products: list.filter((p) => (p.tags ?? []).includes(tag.id)),
      }),
    );
    const untagged = list.filter((p) => (p.tags ?? []).length === 0);
    if (untagged.length > 0)
      sections.push({ key: "untagged", title: "Untagged", products: untagged });
    return sections.filter((s) => s.products.length > 0);
  }
  if (group === "status") {
    return STATUS_ORDER.map((status) => ({
      key: `status-${status}`,
      title: STATUS_LABELS[status],
      products: list.filter((p) => productStatus(p) === status),
    })).filter((s) => s.products.length > 0);
  }
  const regions = Array.from(new Set(list.map(productRegion))).sort();
  return regions.map((region) => ({
    key: `region-${region}`,
    title: region,
    products: list.filter((p) => productRegion(p) === region),
  }));
}

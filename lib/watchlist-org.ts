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
  priceRange?: [number, number];
  inStockOnly?: boolean;
  displayCurrency?: string;
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
  for (const listing of product.listings ?? []) {
    const region = getDistributorById(listing.distributorId)?.region;
    if (region) return region;
  }
  return "Unknown";
}

export function priceDropPercent(product: Product, displayCurrency: string = "USD"): number | null {
  const best = getBestPrice(product.listings ?? [], displayCurrency);
  if (!best || best.price <= 0) return null;
  const history = (product.listings ?? []).flatMap((l) => l.priceHistory ?? []);
  let max = 0;
  for (const point of history) {
    const converted = convertPrice(point.price, point.currency, displayCurrency);
    if (converted === null) continue;
    if (converted > max) max = converted;
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
    if (filters.inStockOnly && productStatus(p) !== "in_stock") return false;
    if (filters.status !== "all" && productStatus(p) !== filters.status)
      return false;
    if (filters.priceRange) {
      const [min, max] = filters.priceRange;
      const currency = filters.displayCurrency ?? "USD";
      const best = getBestPrice(p.listings ?? [], currency);
      if (!best) return false;
      if (best.price < min || best.price > max) return false;
    }
    if (
      q &&
      !p.name.toLowerCase().includes(q) &&
      !p.modelNumber.toLowerCase().includes(q) &&
      !p.brand.toLowerCase().includes(q) &&
      !p.category.toLowerCase().includes(q)
    )
      return false;
    return true;
  });
}

export function countTagMatches(
  list: Product[],
  filters: Pick<WatchlistFilters, "region" | "status" | "query" | "priceRange" | "inStockOnly" | "displayCurrency">,
): Record<string, number> {
  const q = filters.query.trim().toLowerCase();
  const counts: Record<string, number> = {};
  for (const p of list) {
    if (filters.region !== "all" && !productHasRegion(p, filters.region))
      continue;
    if ((filters as WatchlistFilters).inStockOnly && productStatus(p) !== "in_stock")
      continue;
    if (filters.status !== "all" && productStatus(p) !== filters.status)
      continue;
    if ((filters as WatchlistFilters).priceRange) {
      const [min, max] = (filters as WatchlistFilters).priceRange!;
      const currency = (filters as WatchlistFilters).displayCurrency ?? "USD";
      const best = getBestPrice(p.listings ?? [], currency);
      if (!best) continue;
      if (best.price < min || best.price > max) continue;
    }
    if (
      q &&
      !p.name.toLowerCase().includes(q) &&
      !p.modelNumber.toLowerCase().includes(q) &&
      !p.brand.toLowerCase().includes(q) &&
      !p.category.toLowerCase().includes(q)
    )
      continue;
    for (const tagId of p.tags ?? []) {
      counts[tagId] = (counts[tagId] ?? 0) + 1;
    }
  }
  return counts;
}

export function countTagMatchesByIds(
  list: Product[],
  ids: Set<string>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of list) {
    if (!ids.has(p.id)) continue;
    for (const tagId of p.tags ?? []) {
      counts[tagId] = (counts[tagId] ?? 0) + 1;
    }
  }
  return counts;
}

export function sortWatchlist(
  list: Product[],
  sort: WatchlistSort,
  displayCurrency: string = "USD",
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
        const pa = getBestPrice(a.listings ?? [], displayCurrency)?.price ?? Infinity;
        const pb = getBestPrice(b.listings ?? [], displayCurrency)?.price ?? Infinity;
        if (pa !== pb) return pa - pb;
        return (
          new Date(b.addedAt ?? 0).getTime() -
          new Date(a.addedAt ?? 0).getTime()
        );
      });
    case "price_drop":
      return copy.sort((a, b) => {
        const da = priceDropPercent(a, displayCurrency) ?? -Infinity;
        const db = priceDropPercent(b, displayCurrency) ?? -Infinity;
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
    // Deduplicate to first-tag-only: each product appears once in its first live tag section
    const sectionsMap = new Map<string, Product[]>();
    for (const tag of Object.values(tagDefinitions)) {
      sectionsMap.set(`tag-${tag.id}`, []);
    }
    const untagged: Product[] = [];
    for (const p of list) {
      const tags = p.tags ?? [];
      const firstLiveId = tags.find((id) => tagDefinitions[id]);
      if (firstLiveId) {
        const key = `tag-${firstLiveId}`;
        sectionsMap.get(key)?.push(p);
      } else {
        // Orphaned tag ids must be ignored, not treated as a live tag.
        untagged.push(p);
      }
    }
    const sections: WatchlistSection[] = Object.values(tagDefinitions).map(
      (tag) => ({
        key: `tag-${tag.id}`,
        title: tag.name,
        products: sectionsMap.get(`tag-${tag.id}`) ?? [],
      }),
    );
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
  const regionSet = new Set<string>();
  for (const p of list) {
    const listingRegions = (p.listings ?? [])
      .map((l) => getDistributorById(l.distributorId)?.region)
      .filter((r): r is string => Boolean(r));
    if (listingRegions.length === 0) regionSet.add("Unknown");
    else listingRegions.forEach((r) => regionSet.add(r));
  }
  const regions = Array.from(regionSet).sort();
  return regions
    .map((region) => ({
      key: `region-${region}`,
      title: region,
      products: list.filter((p) => {
        if (region === "Unknown") {
          const hasAnyRegion = (p.listings ?? []).some(
            (l) => !!getDistributorById(l.distributorId)?.region,
          );
          return !hasAnyRegion;
        }
        return productHasRegion(p, region);
      }),
    }))
    .filter((s) => s.products.length > 0);
}

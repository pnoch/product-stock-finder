import type { Product, WatchlistGroup } from "../../../lib/types";
import type { WatchlistSection } from "../../../lib/watchlist-org";

export type WatchlistRow =
  | { kind: "header"; key: string; title: string; count: number }
  | { kind: "product"; product: Product };

export function flattenWatchlistRows(
  groupMode: WatchlistGroup,
  sorted: Product[],
  sections: WatchlistSection[],
): WatchlistRow[] {
  if (groupMode === "off") return sorted.map((p) => ({ kind: "product" as const, product: p }));
  return sections.flatMap((s) => [
    { kind: "header" as const, key: s.key, title: s.title, count: s.products.length },
    ...s.products.map((p) => ({ kind: "product" as const, product: p })),
  ]);
}

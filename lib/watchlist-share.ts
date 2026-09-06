import type { Product } from "./types";
import { formatPrice } from "@shared/currency";
import {
  computeBasketValue,
  computeMovers,
  computeStockHealth,
  type MoversWindow,
} from "./watchlist-stats";

export interface WatchlistShareInput {
  watchlist: Product[];
  displayCurrency: string;
  days: MoversWindow;
  now?: number;
}

function windowLabel(days: MoversWindow): string {
  if (days === 7) return "7d";
  if (days === 30) return "30d";
  return "all time";
}

export function buildWatchlistShareText(input: WatchlistShareInput): string {
  const { watchlist, displayCurrency, days } = input;

  const lines: string[] = [
    `My Watchlist — ${watchlist.length} products (${windowLabel(days)})`,
    "",
  ];

  const basket = computeBasketValue(watchlist, displayCurrency);
  if (basket.productCount > 0) {
    lines.push(
      `Basket value: ${formatPrice(basket.total, displayCurrency)} (${basket.productCount} products)`,
    );
  }

  const movers = computeMovers(
    watchlist,
    displayCurrency,
    days,
    input.now ?? Date.now(),
  );
  if (movers.drops.length > 0) {
    lines.push("", `Biggest drops (${windowLabel(days)}):`);
    for (const drop of movers.drops.slice(0, 3)) {
      lines.push(
        `${drop.countryFlag} ${drop.productName} — ${drop.changePct}%`.trimStart(),
      );
    }
  }

  const health = computeStockHealth(watchlist);
  if (health.totalListings > 0) {
    lines.push(
      "",
      `Stock health: ${health.inStockPct}% in stock · ${health.fullyOutOfStock} fully out of stock`,
    );
  }

  lines.push("", "via Product Stock Finder");
  return lines.join("\n");
}

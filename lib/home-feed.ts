import type { PriceAlert, Product } from "@/lib/types";
import type { AwaySummary } from "@/lib/away-summary";
import { computeLocalDrops, type PriceDrop } from "@/lib/price-leaderboard";

export type FeedItem =
  | { kind: "alerts"; alerts: PriceAlert[] }
  | { kind: "drops"; drops: PriceDrop[] }
  | { kind: "restocks"; productIds: string[]; names: Map<string, string> }
  | { kind: "quiet"; dropCount: number };

export function greetingFor(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function buildFeedItems(input: {
  alerts: PriceAlert[];
  products: Product[];
  awaySummary: AwaySummary | null;
  displayCurrency: string;
}): FeedItem[] {
  const { alerts, products, awaySummary, displayCurrency } = input;
  const items: FeedItem[] = [];

  const fired = alerts.filter((a) => a.triggeredAt != null);
  if (fired.length > 0) items.push({ kind: "alerts", alerts: fired });

  const drops = computeLocalDrops(products, "7d", displayCurrency, "pct", 3);
  if (drops.length > 0) items.push({ kind: "drops", drops });

  const restocks = awaySummary?.restocks ?? [];
  if (restocks.length > 0) {
    items.push({
      kind: "restocks",
      productIds: restocks.map((r) => r.productId),
      names: new Map(restocks.map((r) => [r.productId, r.name])),
    });
  }

  if (items.length === 0) {
    items.push({ kind: "quiet", dropCount: drops.length });
  }
  return items;
}

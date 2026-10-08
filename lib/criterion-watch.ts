import type { AvailableProduct, CriterionWatch } from "./types";

export interface CriterionMatch {
  watchId: string;
  productId: string;
  name: string;
  bestPrice: number;
  bestCurrency: string;
  storeCount: number;
}

export function matchesCriterion(
  product: AvailableProduct,
  watch: CriterionWatch,
): boolean {
  if (watch.category && product.category !== watch.category) return false;
  if (watch.brand && product.brand !== watch.brand) return false;
  if (watch.maxPrice != null && product.bestPrice > watch.maxPrice) return false;
  return true;
}

export function evaluateCriterionWatches(input: {
  watches: CriterionWatch[];
  available: AvailableProduct[];
}): { matches: CriterionMatch[]; updated: CriterionWatch[] } {
  const matches: CriterionMatch[] = [];
  const updated = input.watches.map((watch) => {
    if (!watch.isActive) return watch;
    const matching = input.available.filter((p) => matchesCriterion(p, watch));
    const seen = new Set(watch.seenProductIds);
    for (const p of matching) {
      if (seen.has(p.id)) continue;
      matches.push({
        watchId: watch.id,
        productId: p.id,
        name: p.name,
        bestPrice: p.bestPrice,
        bestCurrency: p.bestCurrency,
        storeCount: p.storeCount,
      });
    }
    return { ...watch, seenProductIds: matching.map((p) => p.id) };
  });
  return { matches, updated };
}

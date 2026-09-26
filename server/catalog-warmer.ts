import { PRODUCT_CATALOG } from "../shared/src/catalog.js";
import { DISTRIBUTORS } from "../shared/src/distributors.js";
import { getParserByDistributorId } from "../lib/scrapers/registry";

export interface CatalogPair {
  distributorId: string;
  modelNumber: string;
}

export function buildCatalogPairs(): CatalogPair[] {
  const pairs: CatalogPair[] = [];
  for (const distributor of DISTRIBUTORS) {
    if (!getParserByDistributorId(distributor.id)) continue;
    for (const product of PRODUCT_CATALOG) {
      pairs.push({
        distributorId: distributor.id,
        modelNumber: product.modelNumber,
      });
    }
  }
  return pairs;
}

export function pickPairsToWarm(
  pairs: CatalogPair[],
  fetchedAtMap: Map<string, number>,
  count: number,
  // Last time the warmer *tried* each pair. A pair that never yields a result
  // (the distributor does not carry the model) never reaches the cache, so its
  // fetchedAt stays 0 and it sorted first on every tick, permanently occupying
  // the slots and starving the rest of the catalog.
  attemptedAtMap?: Map<string, number>,
): CatalogPair[] {
  const key = (p: CatalogPair) => `${p.distributorId}:${p.modelNumber}`;
  const rank = (p: CatalogPair) =>
    Math.max(
      fetchedAtMap.get(key(p)) ?? 0,
      attemptedAtMap?.get(key(p)) ?? 0,
    );
  return [...pairs]
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, count);
}

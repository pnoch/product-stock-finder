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
): CatalogPair[] {
  const key = (p: CatalogPair) => `${p.distributorId}:${p.modelNumber}`;
  return [...pairs]
    .sort((a, b) => {
      const aAt = fetchedAtMap.get(key(a)) ?? 0;
      const bAt = fetchedAtMap.get(key(b)) ?? 0;
      return aAt - bAt;
    })
    .slice(0, count);
}

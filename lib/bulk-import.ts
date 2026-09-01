import { PRODUCT_CATALOG } from "./catalog";

export type CatalogProduct = (typeof PRODUCT_CATALOG)[0];

// Splits pasted input on newlines/commas/semicolons, trims whitespace,
// strips one layer of wrapping quotes, drops empties, dedupes case-insensitively.
export function parseModelInput(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const parts = text.split(/[\n,; \t]+/);
  for (const raw of parts) {
    let entry = raw.trim();
    if (
      (entry.startsWith('"') && entry.endsWith('"') && entry.length >= 2) ||
      (entry.startsWith("'") && entry.endsWith("'") && entry.length >= 2)
    ) {
      entry = entry.slice(1, -1);
    }
    entry = entry.trim();
    if (!entry) continue;
    const key = entry.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(entry);
  }
  return result;
}

export interface MatchResult {
  matched: CatalogProduct[];
  unmatched: string[];
}

// Case-insensitive exact modelNumber equality — no substring matching.
export function matchModels(
  models: string[],
  catalog: CatalogProduct[] = PRODUCT_CATALOG,
): MatchResult {
  const byModel = new Map(
    catalog.map((p) => [p.modelNumber.toLowerCase(), p] as const),
  );
  const matched: CatalogProduct[] = [];
  const matchedKeys = new Set<string>();
  const unmatched: string[] = [];
  for (const model of models) {
    const hit = byModel.get(model.toLowerCase());
    if (hit) {
      const key = hit.id;
      if (!matchedKeys.has(key)) {
        matchedKeys.add(key);
        matched.push(hit);
      }
    } else {
      unmatched.push(model);
    }
  }
  return { matched, unmatched };
}

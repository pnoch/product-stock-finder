import Fuse from "fuse.js";
import { PRODUCT_CATALOG } from "./catalog";

export type CatalogProduct = (typeof PRODUCT_CATALOG)[0];

// Splits pasted input on newlines/commas/semicolons, trims whitespace,
// strips one layer of wrapping quotes, drops empties, dedupes case-insensitively.
export function parseModelInput(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const parts = text.split(/[\n,;]+/);
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

export function matchModels(
  models: string[],
  catalog: CatalogProduct[] = PRODUCT_CATALOG,
): MatchResult {
  const fuse = new Fuse(catalog, {
    keys: ["modelNumber"],
    threshold: 0.3,
    includeScore: true,
    ignoreLocation: true,
  });
  const matched: CatalogProduct[] = [];
  const matchedKeys = new Set<string>();
  const unmatched: string[] = [];
  const byExact = new Map(
    catalog.map((p) => [p.modelNumber.toLowerCase(), p] as const),
  );
  for (const model of models) {
    const exact = byExact.get(model.toLowerCase());
    if (exact) {
      const key = exact.id;
      if (!matchedKeys.has(key)) {
        matchedKeys.add(key);
        matched.push(exact);
      }
      continue;
    }
    const results = fuse.search(model);
    const hit = results[0]?.item;
    if (hit && results[0].score !== undefined && results[0].score <= 0.3) {
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

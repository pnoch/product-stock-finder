// Watchlist dedupe keys on `id` only, but an AI-discovered product gets a
// generated id (`discovered-<ts>`) that never matches the static catalog id, so
// the same item could be added twice (and shown as two search rows). Identity
// is brand + model, normalized.
export function productIdentityKey(p: { brand?: string; modelNumber?: string }): string {
  const brand = (p.brand ?? "").trim().toLowerCase();
  const model = (p.modelNumber ?? "").trim().toLowerCase();
  return brand || model ? `${brand}|${model}` : "";
}

export function dedupeByIdentity<T extends { brand?: string; modelNumber?: string }>(
  items: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = productIdentityKey(item);
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(item);
  }
  return out;
}


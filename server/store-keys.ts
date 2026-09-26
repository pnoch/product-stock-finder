// The price_cache/price_history tables are keyed on (distributorId,
// modelNumber) under MySQL's default collation (utf8mb4_0900_ai_ci), which is
// case- and accent-insensitive. The in-memory fallback is a plain Map and is
// case-sensitive, so without folding here the two stores disagree about which
// spellings are the same product: the DB would collapse `CRS804`/`crs804` into
// one row (the later write wins via ON DUPLICATE KEY UPDATE) while memory kept
// two independent entries. Fold to lower case so memory matches the DB.
export function storeKey(distributorId: string, modelNumber: string): string {
  return `${distributorId.toLowerCase()}:${modelNumber.toLowerCase()}`;
}

// price_cache/price_history store DECIMAL(12,4), so MySQL rounds every write to
// four decimal places. The in-memory fallback kept the raw float, so the same
// snapshot could round-trip with different precision depending on which store
// answered. Round to the same scale on the memory write path for parity.
const STORAGE_SCALE = 10_000;

export function storagePrice(value: number): number {
  return Math.round(value * STORAGE_SCALE) / STORAGE_SCALE;
}

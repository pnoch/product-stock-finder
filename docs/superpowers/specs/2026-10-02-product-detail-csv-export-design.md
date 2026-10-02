# Product Detail CSV Export — Design Spec

**Date:** 2026-10-02
**Goal:** Let users export a product's price history as CSV directly from Product Detail, on mobile/web and desktop. CSV export already exists on Compare, Settings → Data, shared watchlists, and Distributor Analysis; Product Detail is the one primary surface missing it (the export moved to Compare in an earlier refactor).

## Decisions (from brainstorming)

- **Content:** the existing per-product history CSV via `productHistoryToCsv(product)` — every listing's price history (date, price, currency, status, distributor name), falling back to the current listing price/status when a product has no history. No new format.
- **Platforms:** all three (mobile, web, desktop), matching the project's cross-platform parity.
- **Placement:** mobile/web a third header icon beside Edit/Share; desktop a button in the existing Product Detail action row.
- **DRY:** extract a desktop `saveCsv` helper and reuse it in the two pages that currently inline the save logic.

## Building blocks that already exist (reused, not rebuilt)

- `lib/csv.ts` → `productHistoryToCsv(product)` (history + current-price fallback); `priceHistoryToCsv` is its lower-level formatter with distributor tagging.
- `lib/csv-export.ts` → `exportCsvFile(csv, fileName)` (web Blob download / native `expo-sharing`), returns a boolean.
- `components/ui/icon-symbol.tsx` → `"square.and.arrow.down": "download"` mapping already present.
- Desktop `desktop/src/lib/tauri.ts` → `isTauri()`.

## 1. Shared predicate — `lib/csv.ts`

Add a pure, testable predicate so both platform handlers share the "is there anything to export?" decision:

```ts
/** True when a product has history or at least one finite listing price. */
export function hasExportablePriceData(product: Product): boolean
```

Returns true if any listing has `priceHistory.length > 0`, or has a `price` that is a finite number (a price of `0` counts as data, matching the existing `watchlistToDetailedCsv` zero-price rule). Returns false for a product with no listings or only non-finite/absent prices. `productHistoryToCsv` remains the single source of the CSV text.

Filename for all platforms: `` `${product.modelNumber ?? product.id}-history.csv` `` (matches the mobile shared-watchlist caller).

## 2. Mobile/web — `app/product/[id].tsx`

- Imports: `productHistoryToCsv`, `hasExportablePriceData` from `@/lib/csv`; `exportCsvFile` from `@/lib/csv-export` (`Haptics`, `showAlert`, `showToast` are already imported).
- New `handleExportCsv` callback:
  1. Guard `product`.
  2. `if (!hasExportablePriceData(product)) { showAlert("Nothing to export", "No price history is available for this product yet."); return; }`
  3. `if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);`
  4. `const ok = await exportCsvFile(productHistoryToCsv(product), fileName);`
  5. `if (!ok) { showAlert("Export unavailable", "We couldn't export the price history on this device."); return; }`
  6. Success haptic on native + `showToast("Price history exported", "success")`.
- Header: add a `TouchableOpacity` after Share with `<IconSymbol name="square.and.arrow.down" size={18} color={colors.primary} />`, `accessibilityLabel="Export CSV"`, `accessibilityRole="button"`, `hitSlop={10}`, `marginLeft: 8`.

## 3. Desktop save helper — `desktop/src/lib/save-csv.ts` (new)

```ts
export async function saveCsv(fileName: string, csv: string): Promise<boolean>
```

- `isTauri()`: dynamic-import `@tauri-apps/plugin-dialog` `save({ defaultPath: fileName, filters: [{ name: "CSV", extensions: ["csv"] }] })`; if the user cancels (falsy path) return `false`; else dynamic-import `@tauri-apps/plugin-fs` `writeFile(path, new TextEncoder().encode(csv))` and return `true`.
- Otherwise (browser): Blob + `URL.createObjectURL` + anchor `download`, revoke the URL, return `true`.
- Wrap everything in try/catch and return `false` on any failure (never throws).

Then refactor `desktop/src/pages/Compare.tsx` and `desktop/src/pages/SharedWatchlist.tsx` to call `saveCsv`, removing the three inline Blob/Tauri blocks and their duplicated imports.

## 4. Desktop Product Detail — `desktop/src/pages/ProductDetail.tsx`

- Imports: `productHistoryToCsv`, `hasExportablePriceData` from `../../../lib/csv`; `saveCsv` from `../lib/save-csv`.
- New `handleExportCsv`: same guard (toast "Nothing to export" when `!hasExportablePriceData`), `await saveCsv(fileName, productHistoryToCsv(product))`, toast `"Price history exported"` on success or `"Couldn't export the price history"` on failure.
- Add an **"Export CSV"** button in the action row (beside Share/Copy Link/Save image), using lucide `Download`, matching the row's existing button styling and `aria-label="Export product price history as CSV"`.

## 5. Error handling

Both handlers never throw. No exportable data → "Nothing to export". Save unsupported/failed/cancelled → "Export unavailable" / "Couldn't export the price history". Success → confirmation toast (and native success haptic on mobile).

## 6. Testing

- `tests/csv.test.ts`: `hasExportablePriceData` — true with history; true with a finite current price; true for a `0` price; false with no listings; false with a non-finite/NaN price.
- `tests/product-detail-csv.test.ts` (source guards): mobile file references `productHistoryToCsv`, `exportCsvFile`, `hasExportablePriceData`, and "Export CSV"; desktop ProductDetail references `productHistoryToCsv`, `saveCsv`, and "Export CSV".
- `desktop/tests/save-csv.test.ts`: browser path creates a downloadable Blob (mock `isTauri` false, stub `URL.createObjectURL`/anchor click) and returns true; Tauri path calls the dialog `save` then `writeFile` and returns true; dialog cancel returns false; rejection returns false.
- Existing suites stay green (`tests/csv.test.ts`, `tests/csv-export.test.ts`, `tests/desktop-compare-shared2.test.ts`, desktop suite).

## 7. Out of scope

- A per-distributor "current listings snapshot" CSV (separate format).
- Selecting which listings/date range to export.
- Changing the existing CSV columns or the import/parse paths.

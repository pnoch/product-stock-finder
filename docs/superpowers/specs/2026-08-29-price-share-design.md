# Rich Text Price Share — Design Spec

**Date:** 2026-08-29
**Goal:** Upgrade the product detail Share button to share a full multi-distributor price comparison as formatted text (top in-stock prices converted to the display currency, out-of-stock fallback, currency note + link).

## Current State

`handleShare` in `app/product/[id].tsx` (~line 265) builds a single-line message: best listing price + status + URL — via RN `Share.share`. The Share button UI (`components/product/action-buttons.tsx`) stays unchanged.

## Pure Module (lib/price-share.ts)

### `buildShareText(input): string`

```typescript
interface PriceShareInput {
  productName: string;
  modelNumber: string;
  listings: DistributorListing[];
  displayCurrency: string;
}
```

Output format:

```
{name} ({modelNumber}) — price comparison

🇩🇪 MikroTik Store — €899.00
🇺🇸 B&H Photo — $1,029.00
🇬🇧 LinITX — £815.50

Prices in USD · via Product Stock Finder
https://mikrotik-store.net/...
```

Rules:
- Filter to `in_stock` listings with convertible prices (`price > 0`, `hasExchangeRate` guard for both listing and display currency); convert via `convertPrice`; sort ascending; take top 5.
- Each row: `{countryFlag} {distributorName} — {formatPrice(converted, displayCurrency)}`; flag/name fall back to distributorId when unknown.
- If no in-stock listings: emit `All out of stock — best listed price {price}` using the cheapest listing regardless of status (converted if possible; native price otherwise).
- Footer always present: `Prices in {displayCurrency} · via Product Stock Finder`.
- Append best (first shown) listing's `url` on its own line when non-empty.
- Empty listings array → header + footer only.

Never throws; pure.

## Wiring

`handleShare` replaces its inline message construction with `buildShareText({...})` and keeps: haptics guard, `Share.share({ message, title })`, try/catch cancel handling. `sortedListings` is already available at that scope.

## Testing

`tests/price-share.test.ts`:
- Mixed currencies converted into display currency, sorted ascending, flags/names resolved.
- Truncation to 5 rows.
- Out-of-stock fallback line.
- Non-convertible-currency listings skipped.
- Empty listings → header + footer only.
- URL appended only when present.

## File Summary

| File | New/Modify |
|------|-----------|
| `lib/price-share.ts` | new (~80 lines) |
| `tests/price-share.test.ts` | new |
| `app/product/[id].tsx` | modify (`handleShare` body) |
| `todo.md` | append Phase 82 |

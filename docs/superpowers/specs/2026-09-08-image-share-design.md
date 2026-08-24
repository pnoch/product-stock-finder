# Image Share Cards — Design Spec

**Date:** 2026-09-08
**Goal:** Share branded image cards (product price comparison + watchlist summary) via a choice sheet alongside existing text sharing.

## Dependency

`react-native-view-shot` — version aligned to Expo SDK 54's `bundledNativeModules.json` (Phase 80 lesson: bare `pnpm add` pulls wrong-era versions).

## Shared Data Layer

Refactor `lib/price-share.ts`: extract

```typescript
export interface ShareRow {
  flag: string;
  name: string;
  price: number; // converted to display currency
}

export function buildShareRows(
  listings: DistributorListing[],
  displayCurrency: string,
): { rows: ShareRow[]; bestUrl: string; allOutOfStock: boolean; fallbackPrice: string | null }
```

`buildShareText` refactored to consume it (behavior unchanged — existing tests must pass).

## Card Components

Both fixed width 360, brand-styled, rendered off-screen by hosts (`position: "absolute"`, `left: -9999`, `pointerEvents: "none"`), always mounted:

- `components/share/product-share-card.tsx` — forwardRef<View>; props `{ productName, modelNumber, rows, currency, bestUrl }`. Layout: brand header bar ("Product Stock Finder"), name + model, row list (flag name … price, first row highlighted "BEST"), footer.
- `components/share/stats-share-card.tsx` — forwardRef<View>; props `{ basketTotal, productCount, drops (top 3: flag/name/pct), stockHealthLine }`. Header, big basket value, drops list, health line, footer.

## Transport (lib/share-image.ts)

```typescript
export async function captureAndShareImage(
  viewRef: React.RefObject<View | null>,
  fileName: string,
): Promise<boolean>
```
- `captureRef(viewRef, { format: "png", result: "tmpfile" })` → `Sharing.shareAsync(uri, { mimeType: "image/png" })`; web: result "dataURL" → anchor download. Returns false on any failure/unsupported platform path.

## UX

Share button on both screens → `showAlert("Share", undefined, [Share as Image, Share as Text, Cancel])`.
- Image path: capture → share; failure → automatic text-share fallback.
- Text path: existing builders (`buildShareText` / `buildWatchlistShareText`).

Hosts render their card off-screen with a ref.

## Testing

Existing `tests/price-share.test.ts` must pass unchanged after refactor (buildShareText behavior identical). New: none required (transport is thin IO); suite green per task.

## File Summary

| File | New/Modify |
|------|-----------|
| `package.json` | +react-native-view-shot |
| `lib/price-share.ts` | refactor (extract buildShareRows) |
| `lib/share-image.ts` | new (~60 lines) |
| `components/share/product-share-card.tsx` | new (~120 lines) |
| `components/share/stats-share-card.tsx` | new (~110 lines) |
| `app/product/[id].tsx` | modify (choice sheet + off-screen card) |
| `app/stats.tsx` | modify (choice sheet + off-screen card) |
| `todo.md` | append Phase 92 |

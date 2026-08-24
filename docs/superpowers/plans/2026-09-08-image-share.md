# Image Share Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Share branded image cards (product comparison + watchlist summary) via a choice sheet next to existing text sharing, with automatic text fallback.

**Architecture:** `buildShareRows` extracted from `lib/price-share.ts` (shared by text + image paths); two off-screen branded card components captured with react-native-view-shot and shared via expo-sharing; choice alert on both Share buttons.

**Tech Stack:** react-native-view-shot 4.0.3 (SDK-54 aligned), expo-sharing, TypeScript strict, vitest.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/price-share.ts` | +`buildShareRows` (refactored buildShareText consumes it) |
| `lib/share-image.ts` | `captureAndShareImage` transport |
| `components/share/product-share-card.tsx` | Branded product card (forwardRef) |
| `components/share/stats-share-card.tsx` | Branded watchlist card (forwardRef) |
| `app/product/[id].tsx` | Choice sheet + off-screen card |
| `app/stats.tsx` | Choice sheet + off-screen card |

---

## Task 1: Dependency + rows extraction

**Files:**
- Modify: `package.json`, `lib/price-share.ts`

- [ ] **Step 1: Install aligned version**

```bash
pnpm add react-native-view-shot@4.0.3
```

- [ ] **Step 2: Refactor `lib/price-share.ts`**

Add exported interface + function; rewrite `buildShareText` to consume it (output must stay byte-identical — existing tests are the guard):

```typescript
export interface ShareRow {
  flag: string;
  name: string;
  price: number;
}

export interface ShareRowsResult {
  rows: ShareRow[];
  bestUrl: string;
  allOutOfStock: boolean;
  fallbackPrice: string | null;
}

export function buildShareRows(
  listings: DistributorListing[],
  displayCurrency: string,
): ShareRowsResult {
  const inStock = listings
    .filter((l) => l.stockStatus === "in_stock")
    .map((l) => ({
      listing: l,
      converted: convert(l.price, l.currency, displayCurrency),
    }))
    .filter((e) => e.converted !== null)
    .sort((a, b) => a.converted! - b.converted!)
    .slice(0, MAX_ROWS);

  if (inStock.length > 0) {
    return {
      rows: inStock.map(({ listing, converted }) => {
        const dist = getDistributorById(listing.distributorId);
        return {
          flag: dist?.countryFlag ?? "",
          name: dist?.name ?? listing.distributorId,
          price: converted!,
        };
      }),
      bestUrl: inStock[0].listing.url ?? "",
      allOutOfStock: false,
      fallbackPrice: null,
    };
  }

  const cheapest = [...listings].sort((a, b) => a.price - b.price)[0];
  if (!cheapest) {
    return { rows: [], bestUrl: "", allOutOfStock: false, fallbackPrice: null };
  }
  const converted = convert(cheapest.price, cheapest.currency, displayCurrency);
  return {
    rows: [],
    bestUrl: cheapest.url ?? "",
    allOutOfStock: true,
    fallbackPrice:
      converted !== null
        ? formatPrice(converted, displayCurrency)
        : formatPrice(cheapest.price, cheapest.currency),
  };
}
```

New `buildShareText` body:

```typescript
export function buildShareText(input: PriceShareInput): string {
  const { productName, modelNumber, listings, displayCurrency } = input;
  const lines: string[] = [
    `${productName} (${modelNumber}) — price comparison`,
    "",
  ];
  const { rows, bestUrl, allOutOfStock, fallbackPrice } = buildShareRows(
    listings,
    displayCurrency,
  );

  if (allOutOfStock && fallbackPrice) {
    lines.push(`All out of stock — best listed price ${fallbackPrice}`);
  }
  for (const row of rows) {
    lines.push(
      `${row.flag} ${row.name} — ${formatPrice(row.price, displayCurrency)}`.trimStart(),
    );
  }

  lines.push("", `Prices in ${displayCurrency} · via Product Stock Finder`);
  if (bestUrl) lines.push(bestUrl);
  return lines.join("\n");
}
```

(`convert` helper stays module-private.)

- [ ] **Step 3: Verify**

Run: `pnpm vitest run tests/price-share.test.ts` — PASS unchanged.
Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml lib/price-share.ts && git commit -m "feat: extract share rows for image cards"
```

---

## Task 2: Transport + cards + wiring + push

**Files:**
- Create: `lib/share-image.ts`, `components/share/product-share-card.tsx`, `components/share/stats-share-card.tsx`
- Modify: `app/product/[id].tsx`, `app/stats.tsx`, `todo.md`

- [ ] **Step 1: Create `lib/share-image.ts`**

```typescript
import { Platform, View } from "react-native";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";

type CaptureRef = typeof captureRef;

export async function captureAndShareImage(
  viewRef: React.RefObject<View | null>,
  fileName: string,
  capture: CaptureRef = captureRef,
): Promise<boolean> {
  try {
    if (!viewRef.current) return false;
    if (Platform.OS === "web") {
      const dataUrl = await capture(viewRef.current, {
        format: "png",
        result: "data-url",
      });
      const anchor = document.createElement("a");
      anchor.href = String(dataUrl);
      anchor.download = `${fileName}.png`;
      anchor.click();
      return true;
    }
    const uri = await capture(viewRef.current, {
      format: "png",
      result: "tmpfile",
    });
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(String(uri), { mimeType: "image/png" });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Create `components/share/product-share-card.tsx`**

Fixed-width (360) brand card, forwardRef<View>. Props `{ productName, modelNumber, rows: ShareRow[], currency, bestUrl }`. Layout:
- Header bar: primary background, white bold "Product Stock Finder"
- Body on surface: name (bold 18), model (muted 12), divider, one row per ShareRow (`flag name` left, `formatPrice(price, currency)` right; first row gets a "BEST" pill in success color)
- Footer: muted "via Product Stock Finder"

Use `useColors()` tokens; wrap content in padding 16, gap styling consistent with other cards.

- [ ] **Step 3: Create `components/share/stats-share-card.tsx`**

Same shell. Props `{ basketTotal: number; productCount: number; displayCurrency: string; drops: Array<{flag,name,pct}>; stockLine: string | null }`:
- Header bar identical
- "My Watchlist" title + big `formatPrice(basketTotal, displayCurrency)` + "{productCount} products"
- Drops section: up to 3 rows `flag name … -N%` (success color pct)
- Stock line when provided; footer branding

- [ ] **Step 4: Wire product detail**

In `app/product/[id].tsx`:
1. Imports: `useRef`; `captureAndShareImage`; `ProductShareCard`; `buildShareRows`.
2. Ref: `const shareCardRef = useRef<View>(null);`
3. Rows memo: `const shareRows = useMemo(() => buildShareRows(sortedListings, displayCurrency), [sortedListings, displayCurrency]);`
4. Off-screen render (near the modals):

```tsx
      <View style={{ position: "absolute", left: -9999, top: 0, pointerEvents: "none" }}>
        <ProductShareCard
          ref={shareCardRef}
          productName={product?.name ?? ""}
          modelNumber={product?.modelNumber ?? ""}
          rows={shareRows.rows}
          currency={displayCurrency}
          bestUrl={shareRows.bestUrl}
        />
      </View>
```

5. Replace `handleShare` body's direct `Share.share` with a choice:

```typescript
    showAlert("Share", undefined, [
      {
        text: "Share as Image",
        onPress: async () => {
          const ok = await captureAndShareImage(shareCardRef, "product-share");
          if (ok) return;
          await Share.share({ message: buildShareText({...same args...}), title: product?.name ?? "Product" });
        },
      },
      { text: "Share as Text", onPress: async () => { await Share.share({ message: buildShareText({...}), title: ... }); } },
      { text: "Cancel", style: "cancel" },
    ]);
```

(Keep haptics at top; keep try/catch semantics per button.)

- [ ] **Step 5: Wire stats screen**

Same pattern in `app/stats.tsx`: off-screen `<StatsShareCard ref>` fed from existing memos (`basket`, `movers.drops.slice(0,3)`, stock health line string), choice alert on the existing share button — image path via `captureAndShareImage(statsCardRef, "watchlist-share")`, text path reuses `buildWatchlistShareText`.

- [ ] **Step 6: Verify**

Run: `pnpm check` — 0 errors. Run: `pnpm lint` — no new errors. Run: `pnpm test` — all pass.

- [ ] **Step 7: Update `todo.md` + commit + push**

Append Phase 92 section:

```markdown
## Phase 92: Image Share Cards (v5.40)

- [x] Extract shared buildShareRows data layer
- [x] Add view-shot capture transport with web download + native share sheet
- [x] Add branded product + watchlist share cards
- [x] Add Image/Text choice sheet with automatic text fallback
```

Then:

```bash
git add lib/share-image.ts lib/price-share.ts components/share app/product/\[id\].tsx app/stats.tsx package.json pnpm-lock.yaml todo.md && git commit -m "feat: add branded image share cards"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| New dep | react-native-view-shot@4.0.3 |
| New modules | share-image transport, 2 branded cards |
| Refactor | buildShareRows extraction (text output unchanged) |

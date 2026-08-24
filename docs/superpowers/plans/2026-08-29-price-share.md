# Rich Text Price Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the product detail Share button to share a multi-distributor price comparison as formatted text.

**Architecture:** Pure `buildShareText` in `lib/price-share.ts` (TDD); `handleShare` in `app/product/[id].tsx` swaps its inline message for the module's output. Share UI unchanged.

**Tech Stack:** TypeScript strict, vitest, RN Share.

---

## Task 1: Share-text module (TDD) + wiring

**Files:**
- Create: `lib/price-share.ts`
- Test: `tests/price-share.test.ts`
- Modify: `app/product/[id].tsx` (`handleShare`, ~line 265)

- [ ] **Step 1: Write failing test `tests/price-share.test.ts`**

```typescript
import { describe, expect, it } from "vitest";
import { buildShareText } from "../lib/price-share";
import type { DistributorListing } from "../lib/types";

function listing(
  overrides: Partial<DistributorListing> & { distributorId: string },
): DistributorListing {
  return {
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "",
    priceHistory: [],
    ...overrides,
  } as DistributorListing;
}

const BASE = {
  productName: "MikroTik CRS804",
  modelNumber: "CRS804-4DDQ-hRM",
  displayCurrency: "USD",
};

describe("buildShareText", () => {
  it("lists in-stock prices converted to display currency, sorted ascending", () => {
    const text = buildShareText({
      ...BASE,
      listings: [
        listing({ distributorId: "bhphoto", price: 1029 }),
        listing({ distributorId: "mikrotikstore", price: 899, currency: "EUR" }),
        listing({ distributorId: "linitx", price: 700, currency: "GBP" }),
      ],
    });
    const lines = text.split("\n");
    expect(lines[0]).toBe("MikroTik CRS804 (CRS804-4DDQ-hRM) — price comparison");
    expect(text).toContain("MikroTik Store");
    expect(text).toContain("B&H Photo");
    expect(text).toContain("LinITX");
    // Sorted ascending by converted USD price
    const priceLines = lines.filter((l) => l.includes("— $"));
    expect(priceLines.length).toBe(3);
    expect(priceLines.indexOf(priceLines.find((l) => l.includes("MikroTik Store"))!)).toBeLessThan(
      priceLines.indexOf(priceLines.find((l) => l.includes("B&H Photo"))!),
    );
    expect(text).toContain("Prices in USD · via Product Stock Finder");
  });

  it("truncates to five rows", () => {
    const listings = Array.from({ length: 8 }, (_, i) =>
      listing({ distributorId: `dist${i}`, price: 100 + i }),
    );
    const text = buildShareText({ ...BASE, listings });
    const rows = text.split("\n").filter((l) => l.includes("dist"));
    expect(rows).toHaveLength(5);
  });

  it("falls back to out-of-stock message when nothing is in stock", () => {
    const text = buildShareText({
      ...BASE,
      listings: [
        listing({ distributorId: "mikrotikstore", stockStatus: "out_of_stock", price: 899 }),
        listing({ distributorId: "winncom", stockStatus: "back_order", price: 950 }),
      ],
    });
    expect(text).toContain("All out of stock");
    expect(text).toContain("via Product Stock Finder");
  });

  it("skips listings without a convertible currency", () => {
    const text = buildShareText({
      ...BASE,
      listings: [
        listing({ distributorId: "bhphoto", price: 999 }),
        listing({ distributorId: "fake", price: 1, currency: "XYZ" }),
      ],
    });
    expect(text).not.toContain("fake");
    expect(text).toContain("B&H Photo");
  });

  it("emits header + footer only for empty listings", () => {
    const text = buildShareText({ ...BASE, listings: [] });
    const lines = text.split("\n");
    expect(lines[0]).toBe("MikroTik CRS804 (CRS804-4DDQ-hRM) — price comparison");
    expect(text).toContain("Prices in USD · via Product Stock Finder");
  });

  it("appends the best listing URL when present", () => {
    const text = buildShareText({
      ...BASE,
      listings: [
        listing({ distributorId: "bhphoto", price: 999, url: "https://bh.example/x" }),
        listing({ distributorId: "winncom", price: 1099, url: "https://wn.example/y" }),
      ],
    });
    expect(text.trimEnd().endsWith("https://bh.example/x")).toBe(true);
    expect(text).not.toContain("https://wn.example/y");
  });
});
```

Note: adjust expected distributor names ("MikroTik Store", "B&H Photo", "LinITX") to whatever `getDistributorById` actually returns for those ids in `lib/distributors.ts` — check before finalizing.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/price-share.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Create `lib/price-share.ts`**

```typescript
import type { DistributorListing } from "./types";
import { convertPrice, hasExchangeRate, formatPrice } from "./currency";
import { getDistributorById } from "./distributors";

export interface PriceShareInput {
  productName: string;
  modelNumber: string;
  listings: DistributorListing[];
  displayCurrency: string;
}

const MAX_ROWS = 5;

function convert(
  price: number,
  currency: string,
  displayCurrency: string,
): number | null {
  if (!(price > 0)) return null;
  if (
    !currency ||
    !hasExchangeRate(currency) ||
    !hasExchangeRate(displayCurrency)
  ) {
    return null;
  }
  return convertPrice(price, currency, displayCurrency);
}

export function buildShareText(input: PriceShareInput): string {
  const { productName, modelNumber, listings, displayCurrency } = input;

  const lines: string[] = [
    `${productName} (${modelNumber}) — price comparison`,
    "",
  ];

  const inStock = listings
    .filter((l) => l.stockStatus === "in_stock")
    .map((l) => ({ listing: l, converted: convert(l.price, l.currency, displayCurrency) }))
    .filter((e) => e.converted !== null)
    .sort((a, b) => a.converted! - b.converted!)
    .slice(0, MAX_ROWS);

  let bestUrl = "";

  if (inStock.length > 0) {
    for (const { listing } of inStock) {
      const dist = getDistributorById(listing.distributorId);
      lines.push(
        `${dist?.countryFlag ?? ""} ${dist?.name ?? listing.distributorId} — ${formatPrice(
          convert(listing.price, listing.currency, displayCurrency)!,
          displayCurrency,
        )}`.trimStart(),
      );
      if (!bestUrl && listing.url) bestUrl = listing.url;
    }
  } else {
    const cheapest = [...listings].sort((a, b) => a.price - b.price)[0];
    if (cheapest) {
      const dist = getDistributorById(cheapest.distributorId);
      const converted = convert(cheapest.price, cheapest.currency, displayCurrency);
      const priceStr =
        converted !== null
          ? formatPrice(converted, displayCurrency)
          : formatPrice(cheapest.price, cheapest.currency);
      lines.push(`All out of stock — best listed price ${priceStr}`);
      if (cheapest.url) bestUrl = cheapest.url;
      void dist;
    }
  }

  lines.push("", `Prices in ${displayCurrency} · via Product Stock Finder`);
  if (bestUrl) lines.push(bestUrl);

  return lines.join("\n");
}
```

(If `void dist` reads awkwardly, drop the unused `dist` lookup in the fallback branch.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/price-share.test.ts` — PASS.
Run: `pnpm check` — 0 errors. Run: `pnpm test` — all pass.

- [ ] **Step 5: Wire into `app/product/[id].tsx`**

Replace `handleShare`'s body (~lines 265-289) so it becomes:

```typescript
  const handleShare = useCallback(async () => {
    if (Platform.OS !== "web")
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: buildShareText({
          productName: product?.name ?? "Product",
          modelNumber: product?.modelNumber ?? "",
          listings: sortedListings,
          displayCurrency,
        }),
        title: product?.name ?? "Product",
      });
    } catch {
      // User cancelled share
    }
  }, [product, sortedListings, displayCurrency]);
```

Add import: `import { buildShareText } from "@/lib/price-share";`. Remove any imports that become unused (check `formatPrice`/`getDistributorById` are still used elsewhere in this file before removing). Note `displayCurrency` must be in scope at that point — verify how it's obtained in this screen (state/hook) and include it in deps.

- [ ] **Step 6: Verify**

Run: `pnpm check` — 0 errors.
Run: `pnpm lint` — no new errors.
Run: `pnpm test` — all pass.

- [ ] **Step 7: Update `todo.md` + commit + push**

Append Phase 82 section:

```markdown
## Phase 82: Rich Text Price Share (v5.30)

- [x] Add pure share-text builder (top-5 in-stock prices, FX conversion, OOS fallback)
- [x] Unit-test formatting edge cases
- [x] Wire product detail Share button to the new comparison text
```

Then:

```bash
git add lib/price-share.ts tests/price-share.test.ts app/product/\[id\].tsx todo.md && git commit -m "feat: share full price comparison from product detail"
git push origin main
```

---

## Summary

| Metric | Value |
|--------|-------|
| New pure module | `lib/price-share.ts` (~80 lines) |
| New tests | `tests/price-share.test.ts` (~6 cases) |
| Modified | `handleShare` in `app/product/[id].tsx` |

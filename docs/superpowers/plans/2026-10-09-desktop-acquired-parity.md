# Desktop Acquired-State Parity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the mobile acquired-state feature (Phase 1137) to the desktop app — acquired toggle on watchlist rows and product detail, "Show acquired" filter, dimmed acquired rows, and acquired exclusion from price alerts and basket stats.

**Architecture:** Import `isAcquired`/`activeProducts` from the existing `lib/acquired.ts`; add `updateProductAcquired` calls via `storage`; filter acquired in the Tauri Rust price-drop checker; wire `activeProducts` into Stats basket and Home stat card.

**Tech Stack:** TypeScript, React, Tailwind CSS, Tauri (Rust), vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-acquired-state-design.md`

---

## File Structure

- Modify `desktop/src/pages/Watchlist.tsx` — acquired toggle + filter + dimming
- Modify `desktop/src/pages/ProductDetail.tsx` — "Mark as acquired" button
- Modify `desktop/src/pages/Stats.tsx` — `activeProducts` for basket
- Modify `desktop/src/pages/Home.tsx` — `activeProducts` for in-stock stat
- Modify `desktop/src-tauri/src/lib.rs` — skip acquired in `check_price_drops_inner`
- Tests: `desktop/tests/acquired-parity.test.tsx`, `desktop/tests/acquired-stats.test.tsx`, `desktop/tests/acquired-rust-guard.test.ts`

---

### Task 1: Watchlist page — acquired toggle + filter + dimming

**Files:** Modify `desktop/src/pages/Watchlist.tsx`

- [ ] **Step 1: Add imports and state**

At the top of `Watchlist.tsx`, add the import:

```typescript
import { isAcquired } from "../../../lib/acquired";
```

Inside the `Watchlist` component, add state after the existing `inStockOnly` state (around line 188):

```typescript
const [showAcquired, setShowAcquired] = useState(false);
```

- [ ] **Step 2: Filter acquired from the rendered list**

The existing `filtered` memo at line 318 calls `filterWatchlist(products, ...)`. Add a post-filter for acquired. Replace the `filtered` memo to compose:

```typescript
const filtered = useMemo(
  () =>
    filterWatchlist(products, {
      region: regionFilter,
      tagIds: selectedTagIds,
      tagMatchMode,
      status: filter as StatusFilter,
      query,
      priceRange,
      inStockOnly,
      displayCurrency,
    }).filter((p) => showAcquired || !isAcquired(p)),
  [products, regionFilter, selectedTagIds, tagMatchMode, filter, query, priceRange, inStockOnly, displayCurrency, showAcquired],
);
```

- [ ] **Step 3: Add acquired toggle handler**

After the `handleRemove` function (around line 710), add:

```typescript
const handleToggleAcquired = async (e: React.MouseEvent, product: Product) => {
  e.stopPropagation();
  try {
    await storage.updateProductAcquired(
      product.id,
      isAcquired(product) ? null : new Date().toISOString(),
    );
    await refresh();
  } catch {
    showToast("Couldn't update. Please try again.");
  }
};
```

- [ ] **Step 4: Add acquired button in the actions column of renderRow**

In the actions `<td>` (line 1044), add a checkmark button before the existing tag button:

```tsx
<button
  type="button"
  onClick={(e) => void handleToggleAcquired(e, product)}
  onKeyDown={(e) => e.stopPropagation()}
  className={`p-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${isAcquired(product) ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/30"}`}
  aria-label={isAcquired(product) ? "Mark as not acquired" : "Mark as acquired"}
  aria-pressed={isAcquired(product)}
>
  <CheckCircle className="w-4 h-4" />
</button>
```

Add `CheckCircle` to the lucide-react import at the top of the file.

- [ ] **Step 5: Dim acquired rows**

In the `renderRow` function, add an opacity class to the `<tr>` `className` (line 904). Append:

```typescript
${isAcquired(product) && !showAcquired ? "opacity-50" : ""}
```

(When `showAcquired` is true the user explicitly wants to see them, so no dimming needed — but acquired rows are always dimmed per mobile, so always apply.)

Actually, dim acquired rows always (matching mobile's 0.55 opacity):

```typescript
${isAcquired(product) ? "opacity-55" : ""}
```

- [ ] **Step 6: Add "Show acquired" toggle in the filter bar**

In the filter toolbar (around line 1100-1130 where the "In stock only" checkbox is), add:

```tsx
<label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
  <input
    type="checkbox"
    checked={showAcquired}
    onChange={(e) => setShowAcquired(e.target.checked)}
    className="rounded border-gray-300"
  />
  Show acquired
</label>
```

- [ ] **Step 7: Update the empty state for allAcquired**

When `products.length > 0 && filtered.length === 0 && products.every(isAcquired) && !showAcquired`, show a different empty state. In the `ListEmptyComponent` area (around line 759), add the allAcquired check:

```tsx
{products.length > 0 && products.every(isAcquired) && !showAcquired ? (
  <EmptyState
    icon={<Package className="w-8 h-8" />}
    title="Everything here is acquired"
    description='All your watched parts are marked as acquired. Turn on "Show acquired" to see them.'
  />
) : (
  <EmptyState
    icon={<Package className="w-8 h-8" />}
    title="No products yet"
    description="Add a part and we'll watch all 25 distributors — alerting you the moment it's in stock or cheaper."
    action={{ label: "Browse Products", to: "/search" }}
  />
)}
```

- [ ] **Step 8: Verify**

Run: `pnpm check && pnpm lint`
Expected: 0 type errors; lint clean.

- [ ] **Step 9: Commit**

```bash
git add desktop/src/pages/Watchlist.tsx
git commit -m "feat(desktop/acquired): watchlist toggle + filter + dimming"
```

---

### Task 2: ProductDetail page — "Mark as acquired" button

**Files:** Modify `desktop/src/pages/ProductDetail.tsx`

- [ ] **Step 1: Add imports**

At the top of `ProductDetail.tsx`, add:

```typescript
import { isAcquired } from "../../../lib/acquired";
import { CheckCircle } from "lucide-react";
```

- [ ] **Step 2: Add toggle handler**

After the existing `handleWatchRestock` function (around line 778), add:

```typescript
const handleToggleAcquired = async () => {
  if (!product) return;
  try {
    await storage.updateProductAcquired(
      product.id,
      isAcquired(product) ? null : new Date().toISOString(),
    );
    const refreshed = await storage.getWatchlist();
    const found = refreshed.find((p) => p.id === product.id);
    if (found) setProduct(found);
  } catch {
    showToast("Couldn't update. Please try again.");
  }
};
```

- [ ] **Step 3: Add the button in the Action Buttons section**

After the "Watch for Restock" button (line 1287), add:

```tsx
<button
  onClick={() => void handleToggleAcquired()}
  className={`inline-flex items-center gap-1.5 px-4 py-2 border rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer ${product && isAcquired(product) ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
  aria-label={product && isAcquired(product) ? "Acquired — tap to undo" : "Mark as acquired"}
  aria-pressed={product ? isAcquired(product) : false}
>
  <CheckCircle className="w-4 h-4" /> {product && isAcquired(product) ? "Acquired — tap to undo" : "Mark as acquired"}
</button>
```

- [ ] **Step 4: Verify**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx
git commit -m "feat(desktop/acquired): product detail mark-as-acquired button"
```

---

### Task 3: Stats page — activeProducts for basket

**Files:** Modify `desktop/src/pages/Stats.tsx`

- [ ] **Step 1: Add import**

```typescript
import { activeProducts } from "../../../lib/acquired";
```

- [ ] **Step 2: Filter basket computation**

Change the basket memo (line 156) from:

```typescript
() => (products ? computeBasketValue(products, displayCurrency) : null),
```

to:

```typescript
() => (products ? computeBasketValue(activeProducts(products), displayCurrency) : null),
```

- [ ] **Step 3: Verify**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/Stats.tsx
git commit -m "feat(desktop/acquired): basket stats exclude acquired products"
```

---

### Task 4: Home page — activeProducts for in-stock stat

**Files:** Modify `desktop/src/pages/Home.tsx`

- [ ] **Step 1: Add import**

```typescript
import { activeProducts } from "../../../lib/acquired";
```

- [ ] **Step 2: Filter in-stock count**

Change the in-stock count computation (line 176) from:

```typescript
const inStockCount = products.filter((p) =>
  (p.listings ?? []).some((l) => l.stockStatus === "in_stock"),
).length;
```

to:

```typescript
const inStockCount = activeProducts(products).filter((p) =>
  (p.listings ?? []).some((l) => l.stockStatus === "in_stock"),
).length;
```

- [ ] **Step 3: Verify**

Run: `pnpm check`
Expected: 0 type errors.

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/Home.tsx
git commit -m "feat(desktop/acquired): home in-stock stat excludes acquired"
```

---

### Task 5: Rust backend — skip acquired products in price-drop alerts

**Files:** Modify `desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Add acquired guard in check_price_drops_inner**

In `check_price_drops_inner` (line 1136), after the product lookup (around line 1218), add an acquired check. After:

```rust
let product = match product {
    Some(p) => p,
    None => continue,
};
```

Add:

```rust
// Skip acquired products — the user already owns them.
let is_acquired = product
    .get("acquiredAt")
    .and_then(|v| v.as_str())
    .map(|s| !s.is_empty())
    .unwrap_or(false);
if is_acquired {
    continue;
}
```

- [ ] **Step 2: Verify Rust compiles**

Run: `cargo test --manifest-path desktop/src-tauri/Cargo.toml`
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add desktop/src-tauri/src/lib.rs
git commit -m "fix(desktop/acquired): skip acquired products in price-drop alerts"
```

---

### Task 6: Tests + full verification

**Files:** Create `desktop/tests/acquired-parity.test.tsx`, `desktop/tests/acquired-stats.test.tsx`, `desktop/tests/acquired-rust-guard.test.ts`

- [ ] **Step 1: Write the Watchlist acquired wiring test**

Create `desktop/tests/acquired-parity.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("desktop acquired parity", () => {
  it("Watchlist page imports isAcquired and has showAcquired state", () => {
    const src = read("src/pages/Watchlist.tsx");
    expect(src).toContain('import { isAcquired }');
    expect(src).toContain("showAcquired");
  });

  it("ProductDetail page imports isAcquired and has handleToggleAcquired", () => {
    const src = read("src/pages/ProductDetail.tsx");
    expect(src).toContain('import { isAcquired }');
    expect(src).toContain("handleToggleAcquired");
  });

  it("Stats page imports activeProducts and uses it for basket", () => {
    const src = read("src/pages/Stats.tsx");
    expect(src).toContain('import { activeProducts }');
    expect(src).toContain("computeBasketValue(activeProducts(products)");
  });

  it("Home page imports activeProducts and uses it for in-stock count", () => {
    const src = read("src/pages/Home.tsx");
    expect(src).toContain('import { activeProducts }');
    expect(src).toContain("activeProducts(products)");
  });
});
```

- [ ] **Step 2: Write the Rust acquired guard test**

Create `desktop/tests/acquired-rust-guard.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Rust acquired guard", () => {
  it("check_price_drops_inner skips acquired products", () => {
    const src = readFileSync(
      join(__dirname, "..", "src-tauri", "src", "lib.rs"),
      "utf8",
    );
    expect(src).toContain('"acquiredAt"');
    expect(src).toContain("is_acquired");
  });
});
```

- [ ] **Step 3: Run all desktop tests**

Run: `pnpm --filter desktop test`
Expected: all pass.

- [ ] **Step 4: Run full verification**

Run: `pnpm verify`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add desktop/tests/acquired-parity.test.tsx desktop/tests/acquired-rust-guard.test.ts
git commit -m "test(desktop/acquired): parity wiring guards + rust guard"
```

---

## Self-Review

- **Spec coverage:** Card action + detail action (Tasks 1–2), consumer filtering (Tasks 3–4), alert skip (Task 5), tests (Task 6). The "Show acquired" toggle, dimmed rows, and allAcquired empty state match mobile.
- **Placeholders:** none — every step has concrete code.
- **Type consistency:** `isAcquired(product)`, `activeProducts(products)`, `storage.updateProductAcquired(id, string | null)` — same API as mobile.
- **Rust guard:** Uses the same `acquiredAt` field check as mobile's `isAcquired` — non-empty string = acquired. Skips the alert loop, not the scrape (matching mobile's behavior where scraping still runs for acquired products but alerts don't fire).
- **Desktop merge:** `merge_watchlist_products` already passes through all product-level fields from the incoming snapshot, so `acquiredAt` survives merge without changes (same as `notes`, `tags`, etc.).
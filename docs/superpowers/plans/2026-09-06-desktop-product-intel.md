# Desktop Product Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop detail answers "good deal?", links per-listing history, and refreshes in place.

**Architecture:** `computePriceVsAverage` memo + card, per-row chart links (a page-level Compare link already exists — the gap is per-row), header refresh + recency label — all in `desktop/src/pages/ProductDetail.tsx`. No server or mobile changes.

**Tech Stack:** React, react-router, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-product-intel-design.md`

---

### Task 1: Guard tests for product intelligence

**Files:**
- Create: `tests/desktop-product-intel.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop product intelligence", () => {
  it("shows price vs average verdict", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("computePriceVsAverage");
    expect(text).toContain("Below average");
  });

  it("links per-row history and shows refresh recency", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("View price history");
    expect(text).toContain("lastRefreshedAt");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-product-intel.test.ts 2>&1 | tail -4`
Expected: FAIL (2 failed — verify strings truly absent).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-product-intel.test.ts
git commit -m "test: guard desktop product intelligence"
```

---

### Task 2: Price-vs-average card

**Files:**
- Modify: `desktop/src/pages/ProductDetail.tsx`

- [ ] **Step 1: Add memo + card**

Read the file's listings/displayCurrency/product variables first (`product?.listings`, `displayCurrency` — verify exact names). Add import: `import { computePriceVsAverage } from "../../../lib/price-average";` (verify export). Add memo:
```tsx
  const priceVsAvg = useMemo(
    () => (product ? computePriceVsAverage(product.listings ?? [], displayCurrency) : null),
    [product, displayCurrency],
  );
```
(Mobile passes all listings + currency — mirror exactly.) Render card (after best-price block, read placement; sibling card classes verbatim), only when non-null:
```tsx
      {priceVsAvg && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Versus 30-day average
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className={`text-2xl font-bold ${priceVsAvg.verdict === "below" ? "text-emerald-600 dark:text-emerald-400" : priceVsAvg.verdict === "above" ? "text-red-600 dark:text-red-400" : "text-gray-500"}`}>
              {priceVsAvg.verdict === "below" ? "▼" : priceVsAvg.verdict === "above" ? "▲" : "—"}{" "}
              {priceVsAvg.percentVsAvg > 0 ? "+" : ""}{priceVsAvg.percentVsAvg.toFixed(1)}%
            </span>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">avg {formatPrice(priceVsAvg.average, displayCurrency)}</p>
              <p className="text-sm font-medium">
                {priceVsAvg.verdict === "below" ? "Below average — good time to buy" : priceVsAvg.verdict === "above" ? "Above average" : "Around its average"}
              </p>
            </div>
          </div>
        </div>
      )}
```
Copy/icons/colors mirror mobile `PriceVsAvgCard` exactly. Verify `formatPrice` imported (likely yes).

- [ ] **Step 2: Verify**

Run: `pnpm vitest run tests/desktop-product-intel.test.ts -t "price vs average"` (passes; other fails) and `pnpm check` (clean).

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx
git commit -m "Feat: desktop detail price-vs-average card. TypeScript: 0 errors."
```

---

### Task 3: History links + refresh control

**Files:**
- Modify: `desktop/src/pages/ProductDetail.tsx`

- [ ] **Step 1: Per-row chart links**

Read the distributor row actions first (Watch/Bell/Visit buttons). Add beside them:
```tsx
                          <Link
                            to={`/compare/${product.id}`}
                            className="...same action-button classes as siblings..."
                            aria-label={`View price history chart for ...`}
                            title="View price history"
                          >
                            <LineChart className="w-3.5 h-3.5" />
                          </Link>
```
Verify `Link` imported from react-router (line 2 imports useParams/useNavigate/Link — confirm Link present, else add). Icon: check lucide `LineChart` export in this file's imports; else reuse an already-imported chart icon (do NOT invent names — grep lucide-react if unsure). `product.id` — verify `product` non-null in row scope (rows render when product loaded — confirm; else guard).

- [ ] **Step 2: Header refresh + updated label**

Read the header block first. Add state: `const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);` Set `setLastRefreshedAt(Date.now())` on successful loadProduct completion (inside loadProduct after setProduct — read exact spot). Add header Refresh button (icon + spinner while `loading`, `onClick={() => void loadProduct()}`, `aria-label="Refresh product"`, disabled while loading) + label `{lastRefreshedAt ? \`Updated ${formatLastRefreshed(...iso...)}\` : ""}` — check `formatLastRefreshed` import + expected arg shape (used with listing.lastChecked — pass `new Date(lastRefreshedAt).toISOString()` if it takes ISO strings, else adapt; read first).

- [ ] **Step 3: Verify**

Run: full guard file (both pass) + `pnpm check` (clean).

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx
git commit -m "Feat: desktop detail history links and refresh control. TypeScript: 0 errors."
```

---

### Task 4: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in ProductDetail.tsx), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.

# Desktop Parity — Shared Package (Approach C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move 6 pure logic modules from `lib/` into `shared/` so desktop and mobile share one source of truth, then bring desktop to full parity (Rates, Search, Watchlist actions, detail rows, alerts).

**Architecture:** Extract `catalog`, `distributors`, `currency`, `fx` (pure), `trending`, `compare-utils` into `shared/src/` with re-export shims left in `lib/`. Desktop rewire from `../lib/*` relative + 4 vite aliases to single `@shared` alias. No new build step — source-consumed by `tsc --noEmit`.

**Tech Stack:** TypeScript, Expo, Vite, tRPC, Drizzle, React Query, NativeWind

---

### Task 1: Create shared package shell

**Files:**
- Create: `shared/src/catalog.ts` (copy from lib)
- Create: `shared/src/distributors.ts` (copy from lib)
- Create: `shared/src/currency.ts` (pure subset)
- Create: `shared/src/fx.ts` (pure subset)
- Create: `shared/src/trending.ts` (pure fetch)
- Create: `shared/src/compare-utils.ts` (copy from lib)

**Steps:**

- [ ] **Step 1: Create shared/src/ with 6 modules**

Copy each file from `lib/` to `shared/src/` verbatim. For `currency.ts` keep only pure exports: `CURRENCY_SYMBOLS`, `CURRENCIES`, `convertPrice`, `formatPrice`, `EXCHANGE_RATES`, `FX_TTL_MS`. Drop `setExchangeRates` side-effect (stays in `lib/currency.ts` wrapper). For `fx.ts` keep `refreshFxRates(pure)`, `loadFxRates`, `maybeRefreshFxRates` without `AsyncStorage` write — wrapper will add it.

```bash
mkdir -p shared/src
cp lib/catalog.ts shared/src/catalog.ts
cp lib/distributors.ts shared/src/distributors.ts
cp lib/compare-utils.ts shared/src/compare-utils.ts
cp lib/trending.ts shared/src/trending.ts
```

`currency.ts` and `fx.ts` need manual split — copy then trim to pure subset per above.

- [ ] **Step 2: Verify shared/src compiles**

```bash
pnpm check 2>&1 | tail -2
```

Expected: `tsc 0`

- [ ] **Step 3: Commit**

```bash
git add shared/src/
git commit -m "feat: shared package — 6 pure modules from lib/"
```

---

### Task 2: Add lib shims + desktop rewire

**Files:**
- Modify: `lib/catalog.ts`, `lib/currency.ts`, `lib/fx.ts`, `lib/distributors.ts`, `lib/compare-utils.ts`, `lib/trending.ts`
- Modify: `desktop/vite.config.ts`
- Modify: `desktop/src/pages/*.tsx` (Search, Rates, Watchlist, ProductDetail, Compare, Alerts)

**Steps:**

- [ ] **Step 1: Replace lib/ files with re-export shims**

Each `lib/<name>.ts` becomes:
```typescript
// Deprecated: prefer @shared/<name>. Kept for one release.
export * from "@shared/<name>";
```

For `lib/currency.ts` keep the side-effect wrapper:
```typescript
export * from "@shared/currency";
import { setExchangeRates as _set } from "@shared/currency";
// ... storage write wrapper ...
```

For `lib/fx.ts` keep:
```typescript
export * from "@shared/fx";
import { refreshFxRates as sharedRefresh } from "@shared/fx";
export async function refreshFxRates() {
  const rates = await sharedRefresh();
  await AsyncStorage.setItem("fx_rates", JSON.stringify(rates));
  return rates;
}
```

- [ ] **Step 2: Rewire desktop imports**

Change `import { searchCatalog } from "../lib/catalog"` → `import { searchCatalog } from "@shared/catalog"` (the `@shared` alias already exists for `shared/_core`; now `shared/src` is covered by `@shared` → `shared/` — add `shared/src` to tsconfig paths if needed).

Grep:
```bash
grep -rn "from \"../lib/" desktop/src/ | head -10
grep -rn "from \"../../lib/" desktop/src/ | head -10
```

Replace each with `@shared/`.

- [ ] **Step 3: Delete the 4 vite aliases in desktop/vite.config.ts**

Remove:
```typescript
"@/lib" → "../lib"
"@/constants" → "../constants"
"@/server" → "../server"
"@/shared" → "../shared"  // the bespoke one — keep the generic @shared alias
```

Keep the RN/expo/playwright stubs; keep the single `@shared` → `shared/` alias.

- [ ] **Step 4: Verify**

```bash
pnpm check 2>&1 | tail -2
pnpm --filter desktop run check 2>&1 | tail -2
pnpm --filter desktop run build 2>&1 | grep -E "✓ built|error" | head -2
```

Expected: all `0`, `✓ built`

- [ ] **Step 5: Commit**

```bash
git add lib/ desktop/vite.config.ts desktop/src/
git commit -m "refactor: desktop rewire to @shared, shim lib/, drop 4 vite aliases"
```

---

### Task 3: Desktop parity — Rates + Search + Watchlist

**Files:**
- Create: `desktop/src/pages/Rates.tsx`
- Modify: `desktop/src/components/SearchModal.tsx`, `desktop/src/pages/Search.tsx`
- Modify: `desktop/src/pages/Watchlist.tsx`
- Modify: `desktop/src/App.tsx` (route + sidebar)

**Steps:**

- [ ] **Step 1: Create Rates page**

```typescript
// desktop/src/pages/Rates.tsx
import { getFxHistory, refreshFxRates } from "@shared/fx";
import { FxRateGrid } from "../components/FxRateGrid";
// ... copy mobile Rates pattern
```

Add route in `desktop/src/App.tsx` and sidebar entry.

- [ ] **Step 2: Wire Search parity**

Add `Fuse` ranked search + `discoveredProducts` (up to 50 via `getAllCatalog()`), `BulkImportModal`, `ManualAddSheet`, `RecentSearches` chips to `desktop/src/components/SearchModal.tsx`.

- [ ] **Step 3: Wire Watchlist parity**

Add bulk select + `TagFilterRow` + `SwipeableCard` affordance to `desktop/src/pages/Watchlist.tsx`.

- [ ] **Step 4: Verify**

```bash
pnpm check 2>&1 | tail -2
pnpm --filter desktop run build 2>&1 | grep -E "✓ built|error" | head -2
```

- [ ] **Step 5: Commit**

```bash
git add desktop/src/
git commit -m "feat: desktop parity — Rates, Search, Watchlist"
```

---

### Task 4: Final verification

- [ ] **Step 1: Full checks**

```bash
pnpm check 2>&1 | tail -2
pnpm --filter desktop run check 2>&1 | tail -2
pnpm test 2>&1 | grep "Test Files" | head -1
pnpm --filter desktop run build 2>&1 | grep -E "✓ built|error" | head -2
```

Expected: `tsc 0`, `tsc 0`, `Test Files ... passed`, `✓ built`

- [ ] **Step 2: Push**

```bash
git push origin main
```

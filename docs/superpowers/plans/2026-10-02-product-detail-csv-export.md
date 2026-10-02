# Product Detail CSV Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Export CSV" action to Product Detail on mobile/web and desktop that saves the product's price history using the existing `productHistoryToCsv` formatter.

**Architecture:** A new pure predicate `hasExportablePriceData` guards both platform handlers. Mobile/web reuses `exportCsvFile`; desktop gets a new `saveCsv` helper (Tauri save dialog / Blob download) that also replaces three inline save blocks in Compare and SharedWatchlist.

**Tech Stack:** TypeScript, React Native/Expo (mobile + web), React + Vite + Tauri (desktop), Vitest, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`.

**Spec:** `docs/superpowers/specs/2026-10-02-product-detail-csv-export-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `lib/csv.ts` | + `hasExportablePriceData(product)` (pure predicate) |
| `app/product/[id].tsx` | mobile/web header "Export CSV" action + handler |
| `desktop/src/lib/save-csv.ts` | new cross-env CSV save helper (Tauri / browser) |
| `desktop/src/pages/Compare.tsx` | use `saveCsv` (remove inline save) |
| `desktop/src/pages/SharedWatchlist.tsx` | use `saveCsv` (remove two inline saves) |
| `desktop/src/pages/ProductDetail.tsx` | desktop "Export CSV" button + handler |
| tests | predicate unit tests, source guards, desktop helper unit tests |

---

## Task 1: `hasExportablePriceData`

**Files:**
- Modify: `lib/csv.ts` (add after `productHistoryToCsv`, which ends at line 163)
- Test: `tests/csv.test.ts` (append a describe)

- [ ] **Step 1: Write the failing test**

Append to `tests/csv.test.ts` (add `hasExportablePriceData` to the line 2 import):

```ts
describe("hasExportablePriceData", () => {
  it("is true when a listing has price history", () => {
    const p = product("p1", [
      listing({ priceHistory: [{ date: "2026-09-01", price: 100, currency: "USD", stockStatus: "in_stock" }] }),
    ]);
    expect(hasExportablePriceData(p)).toBe(true);
  });

  it("is true with a finite current price and no history", () => {
    expect(hasExportablePriceData(product("p1", [listing({ price: 42, priceHistory: [] })]))).toBe(true);
  });

  it("treats a 0 price as data", () => {
    expect(hasExportablePriceData(product("p1", [listing({ price: 0, priceHistory: [] })]))).toBe(true);
  });

  it("is false with no listings", () => {
    expect(hasExportablePriceData(product("p1", []))).toBe(false);
  });

  it("is false with only a non-finite price and no history", () => {
    expect(hasExportablePriceData(product("p1", [listing({ price: Number.NaN, priceHistory: [] })]))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/csv.test.ts`
Expected: FAIL (`hasExportablePriceData` is not exported)

- [ ] **Step 3: Implement**

In `lib/csv.ts`, immediately after `productHistoryToCsv` (line 163), add:

```ts
/**
 * True when a product has price history or at least one finite listing price
 * (0 counts). Decides whether a Product Detail CSV export is useful.
 */
export function hasExportablePriceData(product: Product): boolean {
  return (product.listings ?? []).some(
    (l) =>
      (l.priceHistory?.length ?? 0) > 0 ||
      (typeof l.price === "number" && Number.isFinite(l.price)),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/csv.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/csv.ts tests/csv.test.ts
git commit -m "feat: add hasExportablePriceData predicate"
```

---

## Task 2: Mobile/web Product Detail export

**Files:**
- Modify: `app/product/[id].tsx` (imports near line 21; handler after `handleShare` at line 429-439; header button after the Share button)
- Test: `tests/product-detail-csv.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `tests/product-detail-csv.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("product detail CSV export (mobile/web)", () => {
  it("adds a guarded CSV export action to Product Detail", () => {
    const mobile = readFileSync("app/product/[id].tsx", "utf8");
    expect(mobile).toContain("hasExportablePriceData");
    expect(mobile).toContain("productHistoryToCsv");
    expect(mobile).toContain("exportCsvFile");
    expect(mobile).toContain("Export CSV");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/product-detail-csv.test.ts`
Expected: FAIL (`hasExportablePriceData` not referenced in the screen)

- [ ] **Step 3: Implement**

Add imports to `app/product/[id].tsx` (with the other `@/lib` imports, e.g. after line 21):

```tsx
import { productHistoryToCsv, hasExportablePriceData } from "@/lib/csv";
import { exportCsvFile } from "@/lib/csv-export";
```

Add the handler immediately after the `handleShare` `useCallback` (which ends at line 439):

```tsx
  const handleExportCsv = useCallback(async () => {
    if (!product) return;
    if (!hasExportablePriceData(product)) {
      showAlert("Nothing to export", "No price history is available for this product yet.");
      return;
    }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const fileName = `${product.modelNumber ?? product.id}-history.csv`;
    const ok = await exportCsvFile(productHistoryToCsv(product), fileName);
    if (!ok) {
      showAlert("Export unavailable", "We couldn't export the price history on this device.");
      return;
    }
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast("Price history exported", "success");
  }, [product, showToast]);
```

Add the header button immediately after the Share `TouchableOpacity` (which ends at line 508, before the closing `</View>` of the header controls):

```tsx
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleExportCsv}
            style={{ padding: 4, marginLeft: 8 }}
            accessibilityLabel="Export CSV"
            accessibilityRole="button"
            hitSlop={10}
          >
            <IconSymbol name="square.and.arrow.down" size={18} color={colors.primary} />
          </TouchableOpacity>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/product-detail-csv.test.ts && pnpm check`
Expected: PASS, 0 TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add app/product/[id].tsx tests/product-detail-csv.test.ts
git commit -m "feat: CSV export action on product detail (mobile/web)"
```

---

## Task 3: Desktop `saveCsv` helper + reuse in Compare/SharedWatchlist

**Files:**
- Create: `desktop/src/lib/save-csv.ts`
- Modify: `desktop/src/pages/Compare.tsx` (imports line 1/11; save block 543-568)
- Modify: `desktop/src/pages/SharedWatchlist.tsx` (imports line 9; handlers 112-141)
- Test: `desktop/tests/save-csv.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `desktop/tests/save-csv.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

const tauriState = vi.hoisted(() => ({ isTauri: false }));
vi.mock("../src/lib/tauri", () => ({ isTauri: () => tauriState.isTauri }));

const saveMock = vi.hoisted(() => vi.fn());
const writeFileMock = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: saveMock }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeFile: writeFileMock }));

import { saveCsv } from "../src/lib/save-csv";

describe("saveCsv", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    tauriState.isTauri = false;
  });

  it("downloads via a Blob in the browser", async () => {
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    expect(await saveCsv("x.csv", "a,b\n1,2")).toEqual({ status: "saved" });
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    expect(click).toHaveBeenCalledOnce();
  });

  it("writes the file through the Tauri dialog in the app", async () => {
    tauriState.isTauri = true;
    saveMock.mockResolvedValue("/tmp/x.csv");
    writeFileMock.mockResolvedValue(undefined);
    expect(await saveCsv("x.csv", "a,b")).toEqual({ status: "saved", path: "/tmp/x.csv" });
    expect(saveMock).toHaveBeenCalledWith({
      defaultPath: "x.csv",
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    expect(writeFileMock).toHaveBeenCalledOnce();
  });

  it("reports a cancelled Tauri save dialog as cancelled", async () => {
    tauriState.isTauri = true;
    saveMock.mockResolvedValue(null);
    expect(await saveCsv("x.csv", "a,b")).toEqual({ status: "cancelled" });
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("reports a thrown save as failed", async () => {
    tauriState.isTauri = true;
    saveMock.mockRejectedValue(new Error("boom"));
    expect(await saveCsv("x.csv", "a,b")).toEqual({ status: "failed" });
  });

  it("reports a writeFile failure as failed", async () => {
    tauriState.isTauri = true;
    saveMock.mockResolvedValue("/tmp/x.csv");
    writeFileMock.mockRejectedValue(new Error("write boom"));
    expect(await saveCsv("x.csv", "a,b")).toEqual({ status: "failed" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter desktop test -- save-csv`
Expected: FAIL (`../src/lib/save-csv` not found)

- [ ] **Step 3: Create the helper**

Create `desktop/src/lib/save-csv.ts`:

```ts
import { isTauri } from "./tauri";

export type SaveCsvResult =
  | { status: "saved"; path?: string }
  | { status: "cancelled" }
  | { status: "failed" };

/**
 * Saves CSV text. In the Tauri app this opens a native save dialog and writes
 * the file; in the browser it triggers a download. Distinguishes a user cancel
 * (silent) from a real failure (surface an error). Never throws.
 */
export async function saveCsv(fileName: string, csv: string): Promise<SaveCsvResult> {
  try {
    if (isTauri()) {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeFile } = await import("@tauri-apps/plugin-fs");
      const filePath = await save({
        defaultPath: fileName,
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (!filePath) return { status: "cancelled" };
      await writeFile(filePath, new TextEncoder().encode(csv));
      return { status: "saved", path: filePath };
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      URL.revokeObjectURL(url);
    }
    return { status: "saved" };
  } catch {
    return { status: "failed" };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter desktop test -- save-csv`
Expected: PASS (5 tests)

- [ ] **Step 5: Refactor `Compare.tsx` to use the helper**

In `desktop/src/pages/Compare.tsx`:
- Remove line 1 `import { isTauri } from "../lib/tauri";` and add `import { saveCsv } from "../lib/save-csv";`.
- Replace the save block (lines 548-567, the `if (isTauri()) { ... } else { ... }`) with:

```ts
      const result = await saveCsv(fileName, csv);
      if (result.status === "cancelled") return;
      if (result.status === "failed") {
        showToast("Couldn't export the price history");
        return;
      }
      showToast(result.path ? `Exported to ${result.path}` : "Price history exported");
```

The surrounding `try { ... } catch { showToast("Couldn't export the price history"); }` stays.

- [ ] **Step 6: Refactor `SharedWatchlist.tsx` to use the helper**

In `desktop/src/pages/SharedWatchlist.tsx`, add `import { saveCsv } from "../lib/save-csv";` (next to the `../../../lib/csv` import), then replace the two handlers (lines 112-141) with:

```tsx
  const handleExportHistory = useCallback((product: Product) => {
    void saveCsv(`${product.id}-history.csv`, productHistoryToCsv(product)).then((result) => {
      if (result.status === "cancelled") return;
      showToast(result.status === "saved" ? "History exported" : "Couldn't export history");
    });
  }, [showToast]);

  const handleExportCsv = useCallback(() => {
    const products = (data?.products ?? []) as SharedProduct[];
    // Stamp the source link so re-imports keep provenance (the CSV parser
    // skips /w/ deep-link lines on import).
    const csv = watchlistToDetailedCsv(products as never[], { shareUrl: window.location.href });
    void saveCsv(`shared-${token ?? "watchlist"}.csv`, csv).then((result) => {
      if (result.status === "cancelled") return;
      showToast(result.status === "saved" ? "Share exported as CSV" : "Couldn't export share");
    });
  }, [data, token, showToast]);
```

- [ ] **Step 7: Verify + commit**

Run: `pnpm --filter desktop test` (all pass, incl. `desktop/tests/desktop-compare-shared2.test.ts`) and `pnpm check:desktop` (0 errors).

```bash
git add desktop/src/lib/save-csv.ts desktop/tests/save-csv.test.ts desktop/src/pages/Compare.tsx desktop/src/pages/SharedWatchlist.tsx
git commit -m "feat: shared desktop CSV save helper (Tauri/browser)"
```

---

## Task 4: Desktop Product Detail export

**Files:**
- Modify: `desktop/src/pages/ProductDetail.tsx` (lucide import 4-18; lib imports after line 40; handler after `handleShare` at 699; button after Share at 1272)
- Test: `tests/product-detail-csv.test.ts` (add a desktop describe)

- [ ] **Step 1: Write the failing test**

Append to `tests/product-detail-csv.test.ts`:

Also strengthen the existing mobile assertion (added in Task 2) to catch the button being unwired — add this line inside the mobile `it` block:

```ts
    expect(mobile).toContain("onPress={handleExportCsv}");
```

Add the new desktop describe:

```ts
describe("product detail CSV export (desktop)", () => {
  it("adds a guarded CSV export action to the desktop Product Detail", () => {
    const desktop = readFileSync("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(desktop).toContain("hasExportablePriceData");
    expect(desktop).toContain("productHistoryToCsv");
    expect(desktop).toContain("saveCsv");
    expect(desktop).toContain("Export CSV");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/product-detail-csv.test.ts`
Expected: FAIL (desktop file does not reference `saveCsv`/`hasExportablePriceData`)

- [ ] **Step 3: Implement**

In `desktop/src/pages/ProductDetail.tsx`:
- Add `Download` to the `lucide-react` import (lines 4-18).
- Add imports after line 40 (`buildShareText` import):

```tsx
import { productHistoryToCsv, hasExportablePriceData } from "../../../lib/csv";
import { saveCsv } from "../lib/save-csv";
```

- Add the handler after `handleShare` (ends at line 699):

```tsx
  const handleExportCsv = async () => {
    if (!product) return;
    if (!hasExportablePriceData(product)) {
      showToast("Nothing to export");
      return;
    }
    const fileName = `${product.modelNumber ?? product.id}-history.csv`;
    const result = await saveCsv(fileName, productHistoryToCsv(product));
    if (result.status === "cancelled") return;
    if (result.status === "failed") {
      showToast("Couldn't export the price history");
      return;
    }
    showToast(result.path ? `Exported to ${result.path}` : "Price history exported");
  };
```

- Add the button after the Share button (ends at line 1272):

```tsx
        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 cursor-pointer"
          aria-label="Export product price history as CSV"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/product-detail-csv.test.ts && pnpm check:desktop`
Expected: PASS, 0 TypeScript errors

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx tests/product-detail-csv.test.ts
git commit -m "feat: CSV export button on desktop product detail"
```

---

## Task 5: Full verification + docs

**Files:**
- Modify: `todo.md`

- [ ] **Step 1: Run everything**

Run: `pnpm check && pnpm lint && pnpm test && pnpm check:desktop && pnpm --dir desktop test`
Expected: 0 TypeScript errors (root + desktop), lint 0 errors (pre-existing warnings only), all tests pass. The `tests/agents-doc-drift.test.ts` guard allows the one extra root test file within its 5% band; if it fails, update the `~424 test files` references in `AGENTS.md` to the new count.

- [ ] **Step 2: Append the phase entry to `todo.md`**

```md
## Phase 1037: CSV export from Product Detail (mobile/web + desktop)

- [x] `hasExportablePriceData(product)` predicate in `lib/csv.ts` (history or a finite listing price; 0 counts).
- [x] Mobile/web: header "Export CSV" action on `app/product/[id].tsx` reusing `productHistoryToCsv` + `exportCsvFile`, with empty/failed-export alerts and success toast.
- [x] Desktop: new `desktop/src/lib/save-csv.ts` (Tauri save dialog / browser download, never throws); "Export CSV" button on desktop Product Detail.
- [x] Refactored desktop Compare + SharedWatchlist off three inline Blob/Tauri save blocks onto `saveCsv`.
- [x] Tests: predicate unit cases, mobile+desktop source guards, `desktop/tests/save-csv.test.ts` (browser, Tauri, cancel, failure).
- [x] `tsc 0` (root + desktop), lint 0 errors, root + desktop suites green.
```

- [ ] **Step 3: Commit**

```bash
git add todo.md
git commit -m "Docs: product detail CSV export phase entry (Phase 1037)"
```

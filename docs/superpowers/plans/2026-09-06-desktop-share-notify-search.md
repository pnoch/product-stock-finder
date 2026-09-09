# Desktop Share + Notifications + Search Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compare shares text, detail exports images, notifications open + mark read, search filters by tracked tags.

**Architecture:** Clipboard/download patterns copied from existing desktop share handlers; notification routing on local history entry ids; search mirrors mobile's watchlist-match filter. No server or mobile changes.

**Tech Stack:** React, react-router, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-share-notify-search-design.md`

---

### Task 1: Guard tests for share/notify/search

**Files:**
- Create: `tests/desktop-share-notify-search.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop share, notifications, search tags", () => {
  it("shares comparisons as text", async () => {
    const text = await readFile("desktop/src/pages/Compare.tsx", "utf8");
    expect(text).toContain("buildShareText");
    expect(text).toContain("/#/compare/");
  });

  it("exports product images and opens notifications", async () => {
    const detail = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    const alerts = await readFile("desktop/src/pages/Alerts.tsx", "utf8");
    expect(detail).toContain("toPng");
    expect(alerts).toContain("markNotificationRead");
    expect(alerts).toContain("/product/${");
  });

  it("filters search by tracked tags with counts", async () => {
    const text = await readFile("desktop/src/pages/Search.tsx", "utf8");
    expect(text).toContain("countTagMatches");
    expect(text).toContain("watchlist matches only");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-share-notify-search.test.ts 2>&1 | tail -4`
Expected: FAIL (3 failed — verify each string truly absent; `markNotificationRead`/`countTagMatches` especially must not already be in those files).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-share-notify-search.test.ts
git commit -m "test: guard desktop share, notifications, search tags"
```

---

### Task 2: Compare text share

**Files:**
- Modify: `desktop/src/pages/Compare.tsx`

- [ ] **Step 1: Add share handler + button**

Read the header block first (title/meta + TimeRangeChips row ~440-449; toast div exists at top with showToast — verify). Add import: `import { buildShareText } from "../../../lib/price-share";` (verify path from desktop/src/pages). Handler (beside other handlers; `product`, `sortedListings`(or listings var — read exact name), `displayCurrency` in scope):
```tsx
  const handleShareCompare = useCallback(async () => {
    if (!product) return;
    const message = `${buildShareText({ product, listings: sortedListings, displayCurrency, limit: 5 })}\n\n${window.location.origin}/#/compare/${product.id}`;
    try {
      await navigator.clipboard.writeText(message);
      showToast("Copied to clipboard");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = message;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        showToast("Copied to clipboard");
      } catch {
        showToast("Couldn't copy share text");
      }
      document.body.removeChild(ta);
    }
  }, [product, sortedListings, displayCurrency]);
```
Verify `buildShareText` input shape in lib/price-share.ts (`{product?, productName?, modelNumber?, listings, displayCurrency, limit?}` — pass product object like mobile `app/compare/[id].tsx:278`). Check useCallback import. Button in header row: Share icon (verify lucide export used elsewhere, e.g. Share2 in Stats — match), `aria-label="Share comparison"`.
Deep link form `${origin}/#/compare/${id}` matches desktop hash routing (ProductDetail uses `/#/product/` — verify that pattern in ProductDetail share code first).

- [ ] **Step 2: Verify**

Run: `pnpm vitest run tests/desktop-share-notify-search.test.ts -t "shares comparisons"` (passes; others fail) and `pnpm check` (clean).

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/Compare.tsx
git commit -m "Feat: desktop Compare text share with deep link. TypeScript: 0 errors."
```

---

### Task 3: Product image export

**Files:**
- Modify: `desktop/src/pages/ProductDetail.tsx`

- [ ] **Step 1: Add PNG export of the header card**

Read the detail header card markup first (best-price block area). Attach a ref (`headerRef = useRef<HTMLDivElement>(null)`) to the top summary card container (wrap/attach WITHOUT changing layout/classes). Add import: `import { toPng } from "html-to-image";` (dependency installed — verify in desktop/package.json).
Handler (beside handleShare):
```tsx
  const handleSaveImage = useCallback(async () => {
    if (!headerRef.current || !product) return;
    try {
      const dataUrl = await toPng(headerRef.current);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `product-${product.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("Product image saved");
    } catch {
      showToast("Couldn't save product image");
    }
  }, [product]);
```
Verify `showToast` exists in this file (added in earlier phases — confirm). Button "Save image" (`aria-label="Save product image"`) beside the existing text-share buttons. Existing text share untouched.

- [ ] **Step 2: Verify**

Run: guard `-t "exports product images"` (passes) + `pnpm check` (clean).

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx
git commit -m "Feat: desktop product image export. TypeScript: 0 errors."
```

---

### Task 4: Notification open + single read

**Files:**
- Modify: `desktop/src/pages/Alerts.tsx`

- [ ] **Step 1: Link items + mark read**

Read the notifications list render first (items `n` with title/body/createdAt/read; `NotificationHistoryEntry` has optional `productId`/`distributorId`/type). Wrap each item's content in a `Link` (already imported? verify — Settings link exists in the tab, so yes) to:
- `type === "health"` + distributorId → `/health/{distributorId}`
- productId present → `/product/{productId}`
- else: no link (plain div, unchanged).
onClick (on the Link): if `!n.read`, call `storage.markNotificationRead(n.id)` (verify desktop storage exposes it — createStorage does; confirm) then update local state (`setNotifications(prev => prev.map(...read: true))`). Read the existing `handleMarkAllRead` + state updater first and mirror.
Items without ids stay as-is.

- [ ] **Step 2: Verify**

Run: guard `-t "opens notifications"` — wait, test names: "exports product images and opens notifications" (one test covers detail+alerts). Run `-t "exports product images and opens"` (passes) + `pnpm check` (clean).

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/Alerts.tsx
git commit -m "Feat: desktop notification open + single-read. TypeScript: 0 errors."
```

---

### Task 5: Search tag matches

**Files:**
- Modify: `desktop/src/pages/Search.tsx`

- [ ] **Step 1: Filter by watchlist tag matches + counts**

Read the results memo + TagFilterRow usage first (props: tagDefinitions Record, selectedTagIds=searchTagIds, tagMatchMode=searchTagMode, counts={{}}, onToggleTag...). Add watchlist load: `storage.getWatchlist()` into local state on mount (check existing patterns in file — trackedIds already loaded via getWatchlist! Reuse: need full products for filterWatchlist — read how trackedIds loads; extend to keep products or re-read). Compute:
```tsx
  const tagMatchedIds = useMemo(() => {
    if (searchTagIds.length === 0) return null;
    const matching = filterWatchlist(watchlistProducts, {
      region: "all",
      status: "all",
      query: "",
      tagIds: searchTagIds,
      tagMatchMode: searchTagMode,
    });
    return new Set(matching.map((p) => p.id));
  }, [watchlistProducts, searchTagIds, searchTagMode]);
```
Import `filterWatchlist` + `countTagMatches` (check @shared vs lib paths used by desktop — watchlist-org lives in lib/; desktop imports from "../../../lib/watchlist-org"? Verify how Watchlist.tsx imports groupWatchlist and mirror). Filter `results`: when tagMatchedIds non-null, keep items whose id is matched OR untracked (mirror mobile: `tagFilteredIds.has(id) || !trackedIds.has(id)`). Banner when filtered: "showing watchlist matches only". Counts: `countTagMatches(watchlistProducts, { region: "all", status: "all", query })` replacing `counts={{}}` (verify TagFilterRow counts prop type first — Record<string, number>?).

- [ ] **Step 2: Verify**

Run: full guard file (all 3 pass) + `pnpm check` (clean).

- [ ] **Step 3: Commit**

```bash
git add desktop/src/pages/Search.tsx
git commit -m "Feat: desktop search filters by tracked tags with counts. TypeScript: 0 errors."
```

---

### Task 6: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in the 4 touched files), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.

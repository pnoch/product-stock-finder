# Desktop Watchlist Group-By Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop watchlist table gains group-mode section headers (Off/Tag/Status/Region), persisted like mobile.

**Architecture:** Group picker state + shared `groupWatchlist` applied to the already-sorted list (global sort order preserved within groups); sections render as header rows in the single table. No server or mobile changes.

**Tech Stack:** React, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-group-by-design.md`

---

### Task 1: Guard tests for group-by

**Files:**
- Create: `tests/desktop-group-by.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop watchlist group-by", () => {
  it("offers a group-mode picker", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("groupWatchlist");
    expect(text).toContain("watchlistGroup");
  });

  it("renders section header rows", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("colSpan");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-group-by.test.ts 2>&1 | tail -4`
Expected: FAIL (2 failed — verify neither string already exists; `colSpan` especially must be absent, else report instead of committing).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-group-by.test.ts
git commit -m "test: guard desktop watchlist group-by"
```

---

### Task 2: Group picker + section headers

**Files:**
- Modify: `desktop/src/pages/Watchlist.tsx`

- [ ] **Step 1: Add state + persistence**

`WatchlistGroup` type (`"off" | "tag" | "status" | "region"`) lives in `lib/types.ts` — import type from the existing types import (check it). Add:
```tsx
  const [groupMode, setGroupMode] = useState<WatchlistGroup>("off");
```
Load: extend the existing settings effect (the one loading tag definitions ~line 186) with `setGroupMode(s.watchlistGroup ?? "off");` (read exact shape first). Persist: extend the existing settings-save effect (the P2 one writing watchlistInStockOnly/watchlistPriceRange — read it first) to also write `watchlistGroup: groupMode`, adding `groupMode` to its dep array.

- [ ] **Step 2: Section the sorted list**

Add import: `import { groupWatchlist } from "../../../lib/watchlist-org";` — verify against the file's existing watchlist-org import (it imports `countTagMatches` from there; extend that line). Add memo after `sorted`:
```tsx
  const sections = useMemo(
    () => groupWatchlist(sorted, groupMode, tagDefinitions),
    [sorted, groupMode, tagDefinitions],
  );
```
(`tagDefinitions` state exists ~line 139. Grouping the sorted list preserves global sort order within sections — explicit choice.)

- [ ] **Step 3: Picker UI**

In the filter row near status pills/region (read exact markup): a `<select>` with Off/Tag/Status/Region values, `value={groupMode}`, `aria-label="Group by"`, styled like sibling controls.

- [ ] **Step 4: Header-row render**

Read the tbody render first (`{sorted.map((product) => ...` ~line 893) and the thead column count (8 base columns + conditional selection column → colSpan must be `selectionMode ? 9 : 8`; VERIFY by counting `<th` in the thead, do not hardcode blindly). Replace the flat map with:
```tsx
{groupMode === "off"
  ? sorted.map((product) => (...existing row markup verbatim...))
  : sections.map((section) => (
      <Fragment key={section.key}>
        <tr>
          <td colSpan={selectionMode ? 9 : 8} className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/60">
            {section.title} · {section.products.length}
          </td>
        </tr>
        {section.products.map((product) => (...same existing row markup verbatim...))}
      </Fragment>
    ))}
```
To avoid duplicating the row JSX: extract the existing row into a local render function or keep both maps calling shared markup — simplest: move the row JSX into a `const renderRow = (product: Product) => (...)` above the return (read the row's closure deps first — it uses helpers + state available in scope), then use in both branches. Verify `Fragment` imported from react (add if missing). `off` branch must render byte-identical output to today.
`Product` type import exists (check).

- [ ] **Step 5: Verify**

Run: `pnpm vitest run tests/desktop-group-by.test.ts` (both pass) and `pnpm check` (clean).

- [ ] **Step 6: Commit**

```bash
git add desktop/src/pages/Watchlist.tsx
git commit -m "Feat: desktop watchlist group-by section headers. TypeScript: 0 errors."
```

---

### Task 3: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in Watchlist.tsx), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.

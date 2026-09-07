# Desktop Watchlist Virtualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Watchlist table renders only the visible row window, keeping 60fps on large grouped lists.

**Architecture:** Flatten sections to row descriptors; `useVirtualizer` on the existing scroll div with dynamic measurement; spacer rows preserve table layout; product/header markup reused verbatim. New dep `@tanstack/react-virtual`. No server or mobile changes.

**Tech Stack:** React, @tanstack/react-virtual, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-virtualization-design.md`

---

### Task 1: Guard tests for virtualization

**Files:**
- Create: `tests/desktop-virtualization.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop watchlist virtualization", () => {
  it("windows table rows with dynamic measurement", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain("useVirtualizer");
    expect(text).toContain("measureElement");
    expect(text).toContain("@tanstack/react-virtual");
  });

  it("flattens sections to row descriptors", async () => {
    const text = await readFile("desktop/src/pages/Watchlist.tsx", "utf8");
    expect(text).toContain('kind: "header"');
    expect(text).toContain('kind: "product"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-virtualization.test.ts 2>&1 | tail -4`
Expected: FAIL (2 failed — verify strings truly absent first).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-virtualization.test.ts
git commit -m "test: guard desktop watchlist virtualization"
```

---

### Task 2: Virtualize the table

**Files:**
- Modify: `desktop/package.json` (+ lockfile), `desktop/src/pages/Watchlist.tsx`

- [ ] **Step 1: Install the dependency**

Run with workdir `desktop/`: `pnpm add @tanstack/react-virtual`
Verify `desktop/package.json` gains the dep. Then read its installed types (`desktop/node_modules/@tanstack/react-virtual/build/*.d.ts` or root hoisted copy) to confirm the v3 API names used below (`useVirtualizer`, `measureElement`, `getVirtualItems`, `getTotalSize`); if the installed major version differs (v4+), read its README/types and adapt the code accordingly (same structure), reporting the adaptation.

- [ ] **Step 2: Flatten to row descriptors**

Add type + memo (place after `sections`):
```tsx
  type WatchlistRow =
    | { kind: "header"; key: string; title: string; count: number }
    | { kind: "product"; product: Product };

  const rows = useMemo<WatchlistRow[]>(() => {
    if (groupMode === "off") return sorted.map((p) => ({ kind: "product" as const, product: p }));
    return sections.flatMap((s) => [
      { kind: "header" as const, key: s.key, title: s.title, count: s.products.length },
      ...s.products.map((p) => ({ kind: "product" as const, product: p })),
    ]);
  }, [groupMode, sorted, sections]);
```
Verify `Product` type import exists.

- [ ] **Step 3: Extend renderRow with measurement props**

Read current `renderRow` (takes `product`, returns `<tr key={product.id} ...>`). Change signature to accept virtual props and spread them on the root `<tr>`:
```tsx
  const renderRow = (
    product: Product,
    virtual?: { ref: (el: HTMLTableRowElement | null) => void; index: number },
  ) => (
    <tr key={product.id} ref={virtual?.ref} data-index={virtual?.index} ...existing props...>
```
Match the `measureElement` ref type from installed types (it accepts element|null; adapt the annotation if the types demand a different signature — tsc will confirm). `data-index` omitted when undefined (React skips undefined attributes).

- [ ] **Step 4: Wire the virtualizer + windowed tbody**

Add import: `import { useVirtualizer } from "@tanstack/react-virtual";`
(all other virtualizer options verified against installed types in step 1):
```tsx
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 76,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
```
Verify `scrollRef` is `useRef<HTMLDivElement>(null)` on the scroll div (line ~166, ~945 — confirm). Replace the tbody body (`{groupMode === "off" ? ... : ...}` block, keep `<tbody>` tags) with:
```tsx
            {virtualRows.length > 0 && virtualRows[0].start > 0 && (
              <tr aria-hidden="true">
                <td colSpan={selectionMode ? 8 : 7} style={{ height: virtualRows[0].start, padding: 0, border: 0 }} />
              </tr>
            )}
            {virtualRows.map((vr) => {
              const row = rows[vr.index];
              if (!row) return null;
              if (row.kind === "header") {
                return (
                  <tr key={row.key} ref={rowVirtualizer.measureElement} data-index={vr.index}>
                    <th scope="rowgroup" colSpan={selectionMode ? 8 : 7} className="...existing header classes verbatim...">
                      {row.title} · {row.count}
                    </th>
                  </tr>
                );
              }
              return renderRow(row.product, { ref: rowVirtualizer.measureElement, index: vr.index });
            })}
            {(() => {
              const last = virtualRows[virtualRows.length - 1];
              const remainder = last ? rowVirtualizer.getTotalSize() - last.end : 0;
              return remainder > 0 ? (
                <tr aria-hidden="true">
                  <td colSpan={selectionMode ? 8 : 7} style={{ height: remainder, padding: 0, border: 0 }} />
                </tr>
              ) : null;
            })()}
```
Verify the colSpan expression matches the current one (`selectionMode ? 8 : 7` — recount `<th` if unsure). Header classes: copy verbatim from the existing header row. React `key` warning check: header rows keyed by section key; product rows keyed inside renderRow by product.id. Empty state (`sorted.length === 0` block below table) untouched.

- [ ] **Step 5: Verify**

Run: `pnpm vitest run tests/desktop-virtualization.test.ts` (both pass), `pnpm check` (clean), workdir `desktop/` `pnpm build` (exit 0).

- [ ] **Step 6: Commit**

```bash
git add desktop/package.json desktop/src/pages/Watchlist.tsx tests/desktop-virtualization.test.ts
git commit -m "Feat: virtualize desktop watchlist table. TypeScript: 0 errors."
```
(Check `git status` for lockfile: root `pnpm-lock.yaml` modified by the add → include it too.)

---

### Task 3: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in Watchlist.tsx), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.

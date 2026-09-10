# Desktop Notes + Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desktop detail gains a notes card and an edit sheet.

**Architecture:** Notes via injectable-store helpers (onboarding pattern); edit via existing `storage.updateProductListings`-family `updateProductDetails` + reload. All in `desktop/src/pages/ProductDetail.tsx`. No server or mobile changes.

**Tech Stack:** React, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-desktop-notes-edit-design.md`

---

### Task 1: Guard tests for notes + edit

**Files:**
- Create: `tests/desktop-notes-edit.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop notes and edit", () => {
  it("has a product notes card", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("getProductNote");
    expect(text).toContain("My Note");
  });

  it("edits product details in place", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("updateProductDetails");
    expect(text).toContain("Edit product");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/desktop-notes-edit.test.ts 2>&1 | tail -4`
Expected: FAIL (2 failed — verify strings truly absent first).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/desktop-notes-edit.test.ts
git commit -m "test: guard desktop notes and edit"
```

---

### Task 2: Notes card + edit sheet

**Files:**
- Modify: `desktop/src/pages/ProductDetail.tsx`

- [ ] **Step 1: Notes card**

Imports: `getProductNote, saveProductNote` from `"../../../lib/product-notes"` (verify path from desktop/src/pages). Local store adapter (module scope, onboarding pattern):
```tsx
const notesStore = {
  getItem: (k: string) => Promise.resolve(localStorage.getItem(k)),
  setItem: (k: string, v: string): Promise<void> => {
    localStorage.setItem(k, v);
    return Promise.resolve();
  },
};
```
State (`note`, `editingNote`, `draftNote`) + load effect on `product.id` + save handler (trim; helper deletes on empty; try/catch with error toast/message — read file toast pattern first). Card below the header card (read placement; sibling card classes verbatim): "My Note" + Edit toggle; editing shows textarea + Save/Cancel.

- [ ] **Step 2: Edit sheet**

Header Edit button (icon + `aria-label="Edit product"`). Modal via shared `Modal` component (verify import path/props from another desktop page — e.g. tag-manager usage; `open`/`onClose`/`title` pattern). Fields name/model/brand/category/description prefilled from `product` (draft state reset on open). Save disabled unless changed vs product (dirty check mirroring mobile: compare trimmed fields). On save: `await storage.updateProductDetails(product.id, {...draft trimmed})` (verify desktop storage exposes it — full createStorage, confirm), reload product (reuse `loadProduct()`), close, toast. Failure: inline error, sheet stays open.

- [ ] **Step 3: Verify**

Run: `pnpm vitest run tests/desktop-notes-edit.test.ts` (both pass) and `pnpm check` (clean).

- [ ] **Step 4: Commit**

```bash
git add desktop/src/pages/ProductDetail.tsx
git commit -m "Feat: desktop product notes and edit sheet. TypeScript: 0 errors."
```

---

### Task 3: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in ProductDetail.tsx), `pnpm test` (all pass, 0 failures).

- [ ] **Step 2: Desktop build**

Workdir `desktop/`: `pnpm build` (exit 0).

- [ ] **Step 3: Push**

`git push origin main` (`main -> main`), `git status --short` empty.

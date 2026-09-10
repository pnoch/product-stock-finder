# Hygiene Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove 8 verified hygiene issues — search per-keystroke index rebuilds + 5× inline Fuse options, 3 reactivity hacks, 2 silent delete paths, fire-and-forget poller, 3 dead exports/functions — with no behavior change on success paths.

**Architecture:** Shared pure modules first (`SEARCH_OPTIONS` + price sorter in `shared/src/catalog.ts`), then call-site adoption; failure paths gain warn/rethrow + toast using existing conventions.

**Tech Stack:** TypeScript, Fuse.js, vitest (root excludes `desktop/**`; desktop tests in `desktop/`, jsdom), `pnpm check`, `pnpm lint`.

---

### Task 1: Shared search options + deferred desktop index + price sorter + pendingTags cleanup

**Files:**
- Modify: `shared/src/catalog.ts` (add `SEARCH_OPTIONS` + `sortCatalogByPrice`, delete `searchCatalogFuzzy` + `searchCatalogAsync`)
- Modify: `app/search.tsx` (inline Fuse options → shared; price case → shared sorter; pendingTagsDerived hack)
- Modify: `desktop/src/pages/Search.tsx` (deferral + shared options + sorter + hack)
- Modify: `desktop/src/components/SearchModal.tsx` (same as Search.tsx)
- Test: `tests/catalog-search-guard.test.ts` (new root string-guard) + extend `tests/catalog-search.test.ts` or `tests/catalog.test.ts` (sorter unit tests — check which file fits existing conventions first)

Verified facts (re-confirm at implementation; NEEDS_CONTEXT on mismatch):
- `buildFuse` is module-PRIVATE in catalog.ts; the dead EXPORTS are `searchCatalogFuzzy` (zero repo callers — `grep -rn searchCatalogFuzzy` hits only its definition) and `searchCatalogAsync` (verify zero callers with grep before deleting; if any caller exists, keep it and report).
- All 5 option blocks are identical: keys modelNumber .4 / name .3 / brand .15 / category .1 / description .05, `threshold: 0.4`, `includeScore: true`, `minMatchCharLength: 2`, `ignoreLocation: true`. Keep `includeScore: true` in the shared constant (result-type compatibility).
- Mobile already defers (`useDeferredValue(query)` → `deferredQuery`, `app/search.tsx:223,257`); desktop does not (no `useDeferredValue` in either file).
- Mobile price fallback comment at `app/search.tsx:322-324`; desktop copies at `Search.tsx:183-185`, `SearchModal.tsx:169-172` (`case "price": return copy.sort((a,b) => a.name.localeCompare(b.name))`).
- pendingTagsDerived hacks: desktop `Search.tsx:89,161-164`, `SearchModal.tsx:94,199,231-232`, `app/search.tsx:138,384-385` — derived value `void`ed, bodies read `pendingTags[...]` directly, deps list BOTH `pendingTags` and `pendingTagsDerived`. Since `setPendingTags` always creates a new object identity, listing `pendingTags` alone is sufficient.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/catalog-search-guard.test.ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const SEARCH_SURFACES = [
  "app/search.tsx",
  "desktop/src/pages/Search.tsx",
  "desktop/src/components/SearchModal.tsx",
];

describe("shared search options", () => {
  it("exports SEARCH_OPTIONS and a price sorter from shared catalog", async () => {
    const text = await readFile("shared/src/catalog.ts", "utf8");
    expect(text).toContain("SEARCH_OPTIONS");
    expect(text).toContain("sortCatalogByPrice");
    expect(text).not.toContain("searchCatalogFuzzy");
    expect(text).not.toContain("searchCatalogAsync");
  });
  for (const f of SEARCH_SURFACES) {
    it(`${f} uses shared options with no inline keys`, async () => {
      const text = await readFile(f, "utf8");
      expect(text).not.toContain('"modelNumber", weight');
      expect(text).not.toContain("modelNumber\", weight");
    });
  }
  for (const f of ["desktop/src/pages/Search.tsx", "desktop/src/components/SearchModal.tsx"]) {
    it(`${f} defers the search query`, async () => {
      const text = await readFile(f, "utf8");
      expect(text).toContain("useDeferredValue");
    });
  }
});
```

Adjust the inline-keys negative assertions ONLY to match the actual source shapes (single vs double quotes) — first grep the files for `modelNumber` to get the exact text, then assert its absence. The unit tests for the sorter:

```ts
// append to tests/catalog.test.ts (or catalog-search.test.ts — whichever holds searchCatalog unit tests)
import { sortCatalogByPrice } from "../shared/src/catalog";

it("sorts catalog by name fallback without mutating", () => {
  const input = [{ name: "b" }, { name: "a" }] as Parameters<typeof sortCatalogByPrice>[0];
  const out = sortCatalogByPrice(input);
  expect(out.map((p) => p.name)).toEqual(["a", "b"]);
  expect(input.map((p) => p.name)).toEqual(["b", "a"]);
});
```

Check the catalog item type first (`typeof PRODUCT_CATALOG[number]`) and construct valid fixtures — do not cast garbage; if the type requires many fields, use two real entries from `PRODUCT_CATALOG` reordered.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/catalog-search-guard.test.ts` (repo root)
Expected: FAIL (no `SEARCH_OPTIONS` in catalog.ts).

- [ ] **Step 3: Write minimal implementation**

```ts
// shared/src/catalog.ts — add (place near searchCatalog; import Fuse options type if already imported, else plain object is fine since call sites pass it to `new Fuse` which checks assignability at their site):
export const SEARCH_OPTIONS = {
  keys: [
    { name: "modelNumber", weight: 0.4 },
    { name: "name", weight: 0.3 },
    { name: "brand", weight: 0.15 },
    { name: "category", weight: 0.1 },
    { name: "description", weight: 0.05 },
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2,
  ignoreLocation: true,
} as const;
```

CAUTION: `as const` may break `new Fuse(catalog, SEARCH_OPTIONS)` assignability (readonly arrays vs mutable). If `pnpm check` complains, drop `as const` and type as `Fuse.IFuseOptions<typeof PRODUCT_CATALOG[number]>` (verify the Fuse version's exported type name first — fuse.js v7 exports `IFuseOptions<T>`). Choose whichever passes check; behavior identical.

```ts
// No price on catalog items; fall back to name for deterministic order but keep chip parity
export function sortCatalogByPrice(items: typeof PRODUCT_CATALOG): typeof PRODUCT_CATALOG {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}
```

Delete `searchCatalogFuzzy` + `searchCatalogAsync` (after confirming zero callers). Rewrite private `buildFuse` to use `SEARCH_OPTIONS`.

```tsx
// desktop Search.tsx / SearchModal.tsx — read the current useMemo first, then restructure to:
const fuse = useMemo(() => new Fuse(combinedCatalog, SEARCH_OPTIONS), [combinedCatalog]);
const deferredQuery = useDeferredValue(query);
const results = useMemo(() => {
  if (deferredQuery.trim().length === 0) return baseList;
  return fuse.search(deferredQuery).map((r) => r.item);
}, [deferredQuery, fuse, /* existing other deps (tag filters etc.) unchanged */]);
```

Preserve each file's existing empty-query/tag-filter logic — only swap `query`→`deferredQuery` and the inline options→`SEARCH_OPTIONS`. Import: desktop already imports `@shared/catalog` (`PRODUCT_CATALOG, getAllCategories, getAllBrands`) — extend that import. Mobile imports from `@shared/catalog` too (verify specifier in app/search.tsx first).

Price cases → `return sortCatalogByPrice(copy);` — verify `copy` is already a fresh array at each site (mobile `let out`/`copy` pattern); the sorter copies anyway, so double-copy is harmless.

pendingTags: delete the `pendingTagsDerived` useMemo + `void` line in all three files; remove `pendingTagsDerived` from deps arrays; KEEP `pendingTags` in deps ONLY where the memo body reads it (verify per site — if a body reads neither, drop both).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/catalog-search-guard.test.ts tests/catalog.test.ts tests/catalog-search.test.ts` (root); `pnpm check` (root, 0 errors); `pnpm build` (workdir `desktop/`, exit 0).
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/src/catalog.ts app/search.tsx desktop/src/pages/Search.tsx desktop/src/components/SearchModal.tsx tests/catalog-search-guard.test.ts tests/catalog.test.ts
git commit -m "Refactor: shared search options, deferred index, documented price sort. TypeScript: 0 errors."
```

(Adjust the staged test file if sorter tests landed in `catalog-search.test.ts` instead. Verify via `git status` — stage exactly the touched files.)

---

### Task 2: Audible storage deletes + poller start feedback

**Files:**
- Modify: `lib/storage/idb-adapter.ts:71-100`
- Modify: `desktop/src/background.ts:4-13` (`startPricePoller` rethrows)
- Modify: `desktop/src/pages/Settings.tsx:59-71` (await + toast + revert + cleanup)
- Test: `tests/idb-adapter.test.ts` (new)

Verified facts (re-confirm; NEEDS_CONTEXT on mismatch): `setItem` (`:65-68`) warns `[idb-adapter] setItem fallback failed` and rethrows; `removeItem`/`multiRemove` swallow doubly. `startPricePoller`/`stopPricePoller` are called ONLY from the Settings effect (grep confirms no other callers). Settings has `showToast` (verify import) and `useSettings().update` for revert.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi, afterEach } from "vitest";

describe("idb-adapter remove paths", () => {
  afterEach(() => { vi.restoreAllMocks(); });
  it("warns and rethrows when removeItem fails everywhere", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { createIDBAdapter } = await import("../lib/storage/idb-adapter");
    // verify the exported factory name first — `createIDBAdapter` assumed from sweep; if different, use the real one
    const adapter = createIDBAdapter();
    await expect(adapter.removeItem("k")).rejects.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("[idb-adapter]"), expect.anything());
  });
});
```

Rationale (node env): no `indexedDB` global → IDB path rejects → `localStorage` undefined → guard skips → with warn+rethrow the promise rejects. If the module shape differs (no factory, different export), read the file top first and adapt — the ASSERTED BEHAVIOR (rejects + warns) is what matters. Also add the symmetric `multiRemove` case.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/idb-adapter.test.ts` (root)
Expected: FAIL — promise resolves (silent swallow), no warn.

- [ ] **Step 3: Write minimal implementation**

```ts
// removeItem inner catch:
} catch (e) {
  console.warn("[idb-adapter] removeItem fallback failed", e);
  throw e;
}
// multiRemove inner catch: same with "multiRemove fallback failed"
```

```ts
// background.ts — startPricePoller rethrows so callers can react (stop keeps fire-and-forget: nothing to react to on stop):
export async function startPricePoller(
  intervalMinutes: number = 15,
  apiBaseUrl: string = "",
): Promise<void> {
  try {
    await invoke("start_price_poller", { intervalMinutes, apiBaseUrl });
  } catch (e) {
    console.error("Failed to start price poller:", e);
    throw e;
  }
}
```

```tsx
// Settings.tsx effect — read the current effect first, then:
useEffect(() => {
  const prev = prevIntervalRef.current;
  prevIntervalRef.current = settings?.checkInterval;
  if (!settings || settings.checkInterval === "manual") {
    if (prev && prev !== "manual") stopPricePoller();
    return;
  }
  if (prev && prev !== "manual" && prev !== settings.checkInterval) {
    stopPricePoller();
  }
  const intervalMinutes = settings.checkInterval === "hourly" ? 60 : 1440;
  let cancelled = false;
  (async () => {
    try {
      await startPricePoller(intervalMinutes, getApiBaseUrl());
    } catch {
      if (cancelled) return;
      showToast("Couldn't start background checks — reverted to Manual");
      console.error("[Settings] startPricePoller failed, reverting to manual");
      await update({ checkInterval: "manual" });
    }
  })();
  return () => { cancelled = true; };
}, [settings?.checkInterval]);
```

Verify `showToast`, `update`, `getApiBaseUrl` are all in scope in Settings.tsx (all used elsewhere in the file per verification — re-confirm). The revert triggers the effect again with "manual" → early return → stable, no loop. `stopPricePoller()` calls stay bare (it never rejects).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/idb-adapter.test.ts` (root); `pnpm check` (root, 0 errors); `pnpm build` (workdir `desktop/`, exit 0).
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/storage/idb-adapter.ts tests/idb-adapter.test.ts desktop/src/background.ts desktop/src/pages/Settings.tsx
git commit -m "Fix: audible storage deletes and poller start failures. TypeScript: 0 errors."
```

---

### Task 3: Delete dead Tauri wrapper + legacy token markers

**Files:**
- Modify: `desktop/src/background.ts` (delete `checkPriceDropsNow`)
- Modify: `server/db.ts` (delete `markPasswordResetTokenUsed` + `markEmailVerificationTokenUsed`)
- Modify (only if needed): `tests/password-reset.test.ts`, `tests/oauth-exchange*.test.ts`, `tests/account-management.test.ts`, `tests/auth-hardening.test.ts`, `tests/email-verification.test.ts` (exact filenames — glob first)
- Test: none new (deletions); existing suites must stay green. Optionally extend an existing guard to assert absence — skip, YAGNI (grep in review suffices).

Verified facts (re-confirm; NEEDS_CONTEXT on mismatch):
- `checkPriceDropsNow` in `background.ts:15-21`: zero desktop importers (`Watchlist.tsx:455-456` imports the name from `lib/background-price-check` — a DIFFERENT module; `App.tsx:28` imports only `onPricesChecked/onPriceDropsTriggered`; the string-guard test only asserts `price-drops-triggered` wiring). Delete the wrapper.
- `markPasswordResetTokenUsed` (`db.ts:195-207`) and `markEmailVerificationTokenUsed` (`db.ts:281-293`): production uses atomic `consumePasswordResetToken` (`oauth.ts:696`) / `consumeEmailVerificationToken` (`oauth.ts:822`), both of which handle the mem fallback internally — the `mark*` mem-fallback writes are unreachable from production. Grep prod callers (exclude tests/) before deleting; if ANY production caller exists, STOP → NEEDS_CONTEXT.
- Test files mock these names — read each mock first: if they do `vi.mock("../server/db", () => ({...}))` wholesale factories, removing the export breaks them → update those factories to the `consume*` surface (or drop the mock key if unused). If they only reference the names in assertions about OTHER behavior, leave them.

- [ ] **Step 1: Verify preconditions (no failing test to write — deletion task)**

Run: `grep -rn "checkPriceDropsNow" desktop/src --include=*.ts --include=*.tsx` → expect ONLY `background.ts` definition. Run: `grep -rn "markPasswordResetTokenUsed\|markEmailVerificationTokenUsed" server/ lib/ app/ desktop/ --include=*.ts --include=*.tsx` → expect ONLY `server/db.ts` definitions. If either grep finds a production caller, STOP → NEEDS_CONTEXT.

- [ ] **Step 2: Delete + fix mocks**

Delete the wrapper and both functions. Then run the affected suites: `pnpm vitest run tests/password-reset.test.ts tests/email-verification.test.ts` + the other three files (glob exact names first). Fix ONLY mock breakage caused by the deletion (missing-export errors); do not refactor test logic.

- [ ] **Step 3: Verify**

Run: the 5 test files (PASS); `pnpm check` (root, 0 errors); full `pnpm test` (root, 0 failures — deletions can break distant mocks).
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add desktop/src/background.ts server/db.ts <any-fixed-test-files>
git commit -m "Chore: remove dead poller wrapper and legacy token markers. TypeScript: 0 errors."
```

(Stage exactly the touched files per `git status`.)

---

### Final verification (all tasks)

```bash
pnpm check          # expect: 0 errors
pnpm lint           # expect: 0 errors
pnpm test           # expect: 0 failures (root)
pnpm test           # workdir desktop/ — expect: 0 failures
pnpm build          # workdir desktop/ — expect: exit 0
```

Do NOT push. Report DONE (per-task outcome + verification counts) or BLOCKED/NEEDS_CONTEXT.

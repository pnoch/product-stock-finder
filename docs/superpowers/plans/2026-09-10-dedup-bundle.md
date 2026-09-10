# Dedup Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 9 copy-pasted `LOG_ERROR` definitions, 3 divergent recent-searches implementations, and 6 copy-pasted clipboard/PNG blocks with three shared modules — behavior identical.

**Architecture:** New pure modules (`lib/log.ts`, pure core in `lib/recent-searches.ts`, `desktop/src/lib/share.ts`) with call sites reduced to imports. Desktop imports shared lib code via relative `../../../lib/...` (same as `desktop/src/lib/watchlist-rows.ts`); `@/lib/...` alias also resolves but relative is the established pattern — use relative.

**Tech Stack:** TypeScript, vitest (root `pnpm test` excludes `desktop/**`; desktop tests run via `desktop/ pnpm test` with jsdom), `pnpm check`, `pnpm lint`.

---

### Task 1: Shared logger + migrate 8 mobile/lib call sites

**Files:**
- Create: `lib/log.ts`
- Modify (delete local const, add import): `app/product/[id].tsx:35`, `app/(tabs)/watchlist.tsx:69`, `app/compare/[id].tsx:56`, `components/product/price-chart-modal.tsx:19`, `components/settings/about-section.tsx:15`, `lib/_core/api.ts:6`, `lib/notifications.ts:8` — NOTE: `lib/_core/auth.ts` has BOTH `LOG` (`console.log`) and `LOG_ERROR`; migrate only its `LOG_ERROR`, leave `LOG` alone.
- Test: `tests/log.test.ts` (new)

Import path for mobile/lib files: `@/lib/log` (matches `@/constants/oauth` convention used in `lib/_core/auth.ts`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { LOG_ERROR } from "../lib/log";

describe("LOG_ERROR", () => {
  it("is a callable function", () => {
    expect(typeof LOG_ERROR).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/log.test.ts` (repo root)
Expected: FAIL with "Failed to resolve import ../lib/log" (file does not exist).

- [ ] **Step 3: Write minimal implementation** (`lib/log.ts`)

```ts
export const LOG_ERROR: (...args: unknown[]) => void =
  typeof __DEV__ !== "undefined" && __DEV__ ? console.error.bind(console) : () => {};
```

Why `typeof` guard: `__DEV__` is an RN global and a vite `define` on desktop, but `typeof x !== "undefined"` typechecks even where the name is undeclared — safe in both projects and server-adjacent tooling. Dev behavior identical to the 9 inline copies.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/log.test.ts` (repo root)
Expected: PASS

- [ ] **Step 5: Migrate the 7 call sites** — in each file delete the line `const LOG_ERROR = __DEV__ ? console.error.bind(console) : () => {};` and add `import { LOG_ERROR } from "@/lib/log";` (place with other imports). Verify each file's LOG_ERROR usages remain untouched. In `lib/_core/auth.ts`, delete ONLY the `LOG_ERROR` line; keep `const LOG = __DEV__ ? console.log.bind(console) : () => {};`.

- [ ] **Step 6: Verify + commit**

Run: `pnpm check` (root, expect 0 errors); `pnpm vitest run tests/silent-failures.test.ts tests/log.test.ts` (root, expect PASS — silent-failures asserts on log *messages*, unaffected, but confirm).
```bash
git add lib/log.ts tests/log.test.ts "app/product/[id].tsx" "app/(tabs)/watchlist.tsx" "app/compare/[id].tsx" components/product/price-chart-modal.tsx components/settings/about-section.tsx lib/_core/api.ts lib/notifications.ts
git commit -m "Refactor: shared LOG_ERROR from lib/log across mobile and lib. TypeScript: 0 errors."
```

---

### Task 2: Desktop Stats LOG_ERROR migration

**Files:**
- Modify: `desktop/src/pages/Stats.tsx:27`
- Test: extend `tests/log.test.ts`? No — desktop files can't be imported by root vitest (excluded). Instead extend the string-guard convention: append to `tests/desktop-email-auth.test.ts`? Wrong theme. Create `tests/desktop-log-guard.test.ts`:

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop shared logger", () => {
  it("imports LOG_ERROR from the shared module", async () => {
    const text = await readFile("desktop/src/pages/Stats.tsx", "utf8");
    expect(text).toContain("../../../lib/log");
    expect(text).not.toContain("const LOG_ERROR =");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/desktop-log-guard.test.ts` (repo root)
Expected: FAIL (Stats.tsx still defines its own const).

- [ ] **Step 3: Write minimal implementation** — in `desktop/src/pages/Stats.tsx`, delete line 27 and add `import { LOG_ERROR } from "../../../lib/log";` with the other imports. WARNING: `lib/log.ts` must not pull RN-only imports — it has none (pure). Desktop vite aliases AsyncStorage to a stub, but `lib/log.ts` doesn't import storage at all, so no bundle concern. Confirm `pnpm build` (workdir `desktop/`) still exits 0.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/desktop-log-guard.test.ts` (root, expect PASS); `pnpm build` (workdir `desktop/`, expect exit 0).

- [ ] **Step 5: Commit**

```bash
git add desktop/src/pages/Stats.tsx tests/desktop-log-guard.test.ts
git commit -m "Refactor: desktop Stats uses shared LOG_ERROR. TypeScript: 0 errors."
```

---

### Task 3: Recent-searches pure core + unify all three surfaces

**Files:**
- Modify: `lib/recent-searches.ts` (add pure core, reimplement wrappers on top)
- Modify: `desktop/src/components/SearchModal.tsx:13-34`, `desktop/src/pages/Search.tsx:15-30` (delete local fns, import shared core, keep sync localStorage I/O)
- Test: `tests/recent-searches.test.ts` (append pure-function cases; existing cases must pass UNMODIFIED)

Current desktop logic (both files, verified): `loadRecent` = parse + filter strings + slice(0,8), `[]` on garbage; `recordRecent` = trim, early-return load on empty, case-insensitive dedup, unshift, slice(0,8), save; `saveRecent`/`Clear` = removeItem. The shared core must reproduce exactly this.

- [ ] **Step 1: Write the failing tests** (append to `tests/recent-searches.test.ts`)

```ts
import { addRecentSearch, parseRecentSearches, MAX_RECENT_SEARCHES } from "../lib/recent-searches";

describe("recent searches pure core", () => {
  it("caps at MAX_RECENT_SEARCHES", () => {
    expect(MAX_RECENT_SEARCHES).toBe(8);
    const list = Array.from({ length: 8 }, (_, i) => `q${i}`);
    expect(addRecentSearch(list, "new")).toEqual(["new", "q0", "q1", "q2", "q3", "q4", "q5", "q6"]);
  });
  it("dedups case-insensitively and trims", () => {
    expect(addRecentSearch(["CRS326"], "  crs326 ")).toEqual(["crs326"]);
  });
  it("returns current list on blank query", () => {
    expect(addRecentSearch(["a"], "   ")).toEqual(["a"]);
  });
  it("parses garbage to []", () => {
    expect(parseRecentSearches(null)).toEqual([]);
    expect(parseRecentSearches("not json")).toEqual([]);
    expect(parseRecentSearches('{"a":1}')).toEqual([]);
    expect(parseRecentSearches('["a",1,"b"]')).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/recent-searches.test.ts` (repo root)
Expected: FAIL with "does not provide export named 'addRecentSearch'" (import error, existing tests unaffected).

- [ ] **Step 3: Write minimal implementation** — append to `lib/recent-searches.ts`:

```ts
export const MAX_RECENT_SEARCHES = 8;

export function parseRecentSearches(raw: string | null): string[] {
  try {
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(list: string[], query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return list;
  const filtered = list.filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
  return [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
}
```

Then reimplement the wrappers on top (behavior identical — existing tests pin this):

```ts
export async function getRecentSearches(store: KeyValueStore = AsyncStorage): Promise<string[]> {
  try {
    return parseRecentSearches(await store.getItem(KEY));
  } catch {
    return [];
  }
}

export async function recordSearch(
  query: string,
  store: KeyValueStore = AsyncStorage,
): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) return getRecentSearches(store);
  const updated = addRecentSearch(await getRecentSearches(store), trimmed);
  try {
    await store.setItem(KEY, JSON.stringify(updated));
  } catch {
    // Best-effort persistence.
  }
  return updated;
}
```

Keep `KEY` (private) and `clearRecentSearches` exactly as-is. Note: original `recordSearch` early-returns `getRecentSearches(store)` on blank — preserved. Original slices on save (`setItem(JSON.stringify(updated))` where updated already capped) — preserved.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/recent-searches.test.ts` (repo root)
Expected: PASS — all pre-existing cases unmodified + 4 new.

- [ ] **Step 5: Migrate desktop** — in BOTH `desktop/src/components/SearchModal.tsx` and `desktop/src/pages/Search.tsx`, replace the three local functions with the shared import plus thin sync I/O:

```ts
import { addRecentSearch, parseRecentSearches, MAX_RECENT_SEARCHES } from "../../../lib/recent-searches";

const RECENT_KEY = "recent_searches";

function loadRecent(): string[] {
  try {
    return parseRecentSearches(localStorage.getItem(RECENT_KEY)).slice(0, MAX_RECENT_SEARCHES);
  } catch { return []; }
}
function saveRecent(list: string[]) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT_SEARCHES))); } catch {}
}
function recordRecent(query: string): string[] {
  const updated = addRecentSearch(loadRecent(), query);
  if (query.trim()) saveRecent(updated);
  return updated;
}
```

Behavior check vs originals: blank query → `addRecentSearch` returns list unchanged, no save (original: no save either — it returns `loadRecent()` without saving). Identical. `loadRecent` slice: `parseRecentSearches` doesn't cap (shared parse returns all strings — matches lib's original `getRecentSearches` which never sliced on load); the `.slice(0, MAX)` preserves desktop's load-time cap. Delete the now-duplicated local `MAX` literal `8` usages.

- [ ] **Step 6: Verify + commit**

Run: `pnpm check` (root, 0 errors); `pnpm build` (workdir `desktop/`, exit 0 — proves the vite bundle accepts the shared import despite the AsyncStorage stub alias: `recent-searches.ts` imports AsyncStorage at module top, which vite maps to `src/lib/async-storage-stub.ts` — verify the stub's export shape satisfies `KeyValueStore` usage at import time; if the build fails on this, fall back to importing ONLY the pure core via a new `lib/recent-searches-core.ts` with zero imports, and note the fallback in the commit message).
```bash
git add lib/recent-searches.ts tests/recent-searches.test.ts desktop/src/components/SearchModal.tsx desktop/src/pages/Search.tsx
git commit -m "Refactor: shared recent-searches core across mobile and desktop. TypeScript: 0 errors."
```

---

### Task 4: Desktop share helpers + migrate 6 call sites

**Files:**
- Create: `desktop/src/lib/share.ts`
- Modify: `desktop/src/pages/Watchlist.tsx:441-460` (handleShare), `desktop/src/pages/Compare.tsx:414-432` (handleShareCompare), `desktop/src/pages/Compare.tsx:435-449` (handleSaveImage), `desktop/src/pages/ProductDetail.tsx:551-564` (handleSaveImage), `desktop/src/pages/Stats.tsx:60-95` (handleCopyText + handleSaveImage)
- Test: `desktop/tests/share.test.tsx` (new; jsdom — follow `desktop/tests/pages.test.tsx` imports for Testing Library only if needed; pure function tests need no rendering)

DO NOT migrate: `ProductDetail.tsx:533-547` (clipboard → toast deepLink, no textarea fallback — different UX, leave); `Settings.tsx:471` (clipboard with "Share link created" fallback toast — different UX, leave). The spec's §C Settings note referred to a stale line number — verify: grep Settings.tsx for `execCommand`; if a textarea-fallback copy exists there, migrate it too, else leave Settings untouched and note why in the commit message.

- [ ] **Step 1: Write the failing tests** (`desktop/tests/share.test.tsx`)

```tsx
import { describe, expect, it, vi, beforeEach } from "vitest";
import { copyTextWithFallback, saveNodeAsPng } from "../src/lib/share";

vi.mock("html-to-image", () => ({ toPng: vi.fn() }));
import { toPng } from "html-to-image";

beforeEach(() => { vi.clearAllMocks(); });

describe("copyTextWithFallback", () => {
  it("uses the clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    await expect(copyTextWithFallback("hello")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });
  it("falls back to textarea + execCommand", async () => {
    Object.assign(navigator, { clipboard: undefined });
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand as typeof document.execCommand;
    await expect(copyTextWithFallback("hello")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });
  it("returns false when everything fails", async () => {
    Object.assign(navigator, { clipboard: undefined });
    document.execCommand = (() => { throw new Error("denied"); }) as typeof document.execCommand;
    await expect(copyTextWithFallback("hello")).resolves.toBe(false);
  });
});

describe("saveNodeAsPng", () => {
  it("saves the node as a download", async () => {
    vi.mocked(toPng).mockResolvedValue("data:image/png;base64,abc");
    const click = vi.fn();
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      if (tag === "a") return { href: "", download: "", click } as unknown as HTMLElement;
      return document.createElement(tag);
    }) as typeof document.createElement);
    await saveNodeAsPng(document.createElement("div"), "out.png");
    expect(toPng).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
  });
  it("throws when toPng fails", async () => {
    vi.mocked(toPng).mockRejectedValue(new Error("rasterize"));
    await expect(saveNodeAsPng(document.createElement("div"), "out.png")).rejects.toThrow();
  });
});
```

Caveat: `document.createElement` mock interferes with the fallback test if run in same file — the fallback path uses `document.createElement("textarea")`; the mock above only special-cases `"a"` and delegates otherwise via the ORIGINAL `document.createElement` — but `vi.spyOn` replaces it, so delegation must capture the original first: `const realCreate = document.createElement.bind(document);` then delegate. Write it that way (adjust the sketch above accordingly at implementation time — the behavior asserted is what matters).

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test share` (workdir `desktop/`)
Expected: FAIL — `../src/lib/share` does not exist.

- [ ] **Step 3: Write minimal implementation** (`desktop/src/lib/share.ts`)

```ts
import { toPng } from "html-to-image";

export async function copyTextWithFallback(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(ta);
    }
  }
}

export async function saveNodeAsPng(node: HTMLElement, filename: string): Promise<void> {
  const dataUrl = await toPng(node);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
```

Note the `finally` for textarea removal — the originals removed the node only on the success path inside try and after catch; `finally` is strictly safer (removes even if execCommand throws outside inner try — impossible today, but harmless). Keep semantics: return true only when a copy method succeeded.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test share` (workdir `desktop/`)
Expected: PASS

- [ ] **Step 5: Migrate the 6 call sites** — each becomes:

```tsx
// clipboard pairs (Watchlist handleShare, Compare handleShareCompare, Stats handleCopyText):
if (await copyTextWithFallback(message)) showToast("Copied to clipboard");
else showToast("Couldn't copy share text");
```

```tsx
// PNG trios (Compare handleSaveImage filename `compare-${product.id}.png`,
// ProductDetail `product-${product.id}.png`, Stats `stats-watchlist.png`):
try {
  if (!chartRef.current || !product) return;
  await saveNodeAsPng(chartRef.current, `compare-${product.id}.png`);
  showToast("Comparison image saved");
} catch {
  showToast("Couldn't save comparison image");
}
```

Keep each page's own toast strings, filenames, and early-returns byte-identical — only the mechanism lines change. Remove now-unused `toPng` imports where no other use remains (verify per file: Compare/ProductDetail/Stats each import toPng — confirm no other toPng call remains before removing the import).

- [ ] **Step 6: Verify + commit**

Run: `pnpm test share` (desktop, PASS); `pnpm check` (root, 0 errors); `pnpm build` (desktop, exit 0); `pnpm lint` (root, clean). Guard: `grep -rn "execCommand" desktop/src --include=*.tsx --include=*.ts -l` must list ONLY `desktop/src/lib/share.ts` (plus the test).
```bash
git add desktop/src/lib/share.ts desktop/tests/share.test.tsx desktop/src/pages/Watchlist.tsx desktop/src/pages/Compare.tsx desktop/src/pages/ProductDetail.tsx desktop/src/pages/Stats.tsx
git commit -m "Refactor: shared desktop clipboard and PNG helpers. TypeScript: 0 errors."
```

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

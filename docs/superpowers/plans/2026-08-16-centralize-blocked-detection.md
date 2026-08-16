# Centralize Blocked Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `classifyFetchStatus` in `lib/scrapers/resilient.ts` the single owner of blocked-marker detection by having `classifyResult` in `lib/scrapers/health.ts` delegate to it.

**Architecture:** `health.ts` drops its inline copy of the 4 Cloudflare markers and calls `classifyFetchStatus(html)`. `BLOCKED_MARKERS` is exported from `resilient.ts` so a regression test can iterate the single source of truth. Behavior is unchanged; only the marker list's home is centralized.

**Tech Stack:** TypeScript (strict), vitest, Expo/React Native + scaffolded Express/tRPC server.

---

## File Structure

- Modify: `lib/scrapers/resilient.ts:28` — change `const BLOCKED_MARKERS` to `export const BLOCKED_MARKERS` (one word, no behavioral change).
- Modify: `lib/scrapers/health.ts:1-35` — import `classifyFetchStatus`, replace the inline marker checks in `classifyResult`.
- Test: `tests/scrapers/health.test.ts` — add one regression test iterating `BLOCKED_MARKERS`.

---

### Task 1: Delegate classifyResult to classifyFetchStatus

**Files:**
- Modify: `lib/scrapers/resilient.ts:28`
- Modify: `lib/scrapers/health.ts:1-35`
- Test: `tests/scrapers/health.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/scrapers/health.test.ts`, after the existing `classifyResult` describe block's closing `});` (line 46):

```ts
it("detects every marker from the single source of truth", () => {
  for (const marker of BLOCKED_MARKERS) {
    expect(classifyResult(marker, null)).toBe("blocked");
  }
});
```

And update the import at the top of the file (line 2) to also import `BLOCKED_MARKERS`:

```ts
import { classifyResult, createHealthService } from "@/lib/scrapers/health";
import { BLOCKED_MARKERS } from "@/lib/scrapers/resilient";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- tests/scrapers/health.test.ts`
Expected: FAIL — `BLOCKED_MARKERS` is not exported from `@/lib/scrapers/resilient` (module resolution/type error).

- [ ] **Step 3: Export BLOCKED_MARKERS**

In `lib/scrapers/resilient.ts:28`, change:

```ts
const BLOCKED_MARKERS = [
```

to:

```ts
export const BLOCKED_MARKERS = [
```

- [ ] **Step 4: Delegate classifyResult to classifyFetchStatus**

In `lib/scrapers/health.ts`:

1. Add to the imports (after line 3, `import { fetchWithParser } from "./utils";`):

```ts
import { classifyFetchStatus } from "./resilient";
```

2. Replace the body of `classifyResult` (lines 24-34) with:

```ts
  if (error) return "error";
  if (classifyFetchStatus(html) === "blocked") return "blocked";
  if (result && result.price > 0) return "working";
  return "error";
```

The full function becomes:

```ts
export function classifyResult(
  html: string,
  result: ScrapeResult | null,
  error?: unknown,
): HealthStatus {
  if (error) return "error";
  if (classifyFetchStatus(html) === "blocked") return "blocked";
  if (result && result.price > 0) return "working";
  return "error";
}
```

`classifyFetchStatus(html)` is called without `httpStatus`, so it returns `"ok" | "blocked"` from markers alone — `=== "blocked"` is the only check needed.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test -- tests/scrapers/health.test.ts`
Expected: PASS — all 8 `classifyResult` tests (7 existing + 1 new) and the 3 `createHealthService` tests.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `pnpm check && pnpm lint && pnpm test`
Expected: 0 TypeScript errors, lint clean, full suite green (633 passed / 9 skipped baseline + no new failures).

- [ ] **Step 7: Commit**

```bash
git add lib/scrapers/resilient.ts lib/scrapers/health.ts tests/scrapers/health.test.ts
git commit -m "Centralize blocked detection in classifyFetchStatus"
```

---

## Self-Review Notes

- **Spec coverage:** Every spec item has a task step — export `BLOCKED_MARKERS` (Step 3), delegate `classifyResult` (Step 4), regression test iterating the single source (Step 1). Scope exclusions honored: `testAllDistributors` and `fetchWithParser` untouched; no new files.
- **Type consistency:** `classifyFetchStatus` already exists with signature `(html: string, httpStatus?: number) => "ok" | "blocked" | "error"` — no signature changes. `BLOCKED_MARKERS` is `string[]`; the test's `for...of` iterates strings passed as `html`.
- **Placeholder scan:** All steps contain concrete code and expected output.

## Final Verification

- [ ] `pnpm check` — 0 errors
- [ ] `pnpm lint` — clean
- [ ] `pnpm test` — full suite green
- [ ] Update `todo.md` with a Phase 49 entry and commit checkpoint (`Checkpoint: v4.7.2: Centralize blocked detection. TypeScript: 0 errors.`), then `git push origin main`
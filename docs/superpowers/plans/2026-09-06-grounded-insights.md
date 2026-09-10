# Grounded Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LLM insights see the deterministic deal score and must agree with it.

**Architecture:** `buildInsightContext` gains a `dealScore` field; one prompt sentence added. Tests capture the mocked LLM call (existing `vi.mock` patterns in `tests/price-insights.test.ts`). No endpoint, cache, or client changes.

**Tech Stack:** TypeScript, vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-grounded-insights-design.md`

---

### Task 1: Grounding tests

**Files:**
- Modify: `tests/price-insights.test.ts`

- [ ] **Step 1: Read existing patterns first**

Read the full file (mocks for price-cache/price-history/LLM, `getInsight` flows, how `PRODUCT_CATALOG` lookup is satisfied in tests — real catalog id or mock). Mirror its fixture style.

- [ ] **Step 2: Add tests**

```ts
it("includes the deal score in the LLM context", async () => {
  // getHistory returns rich falling history (mirror existing rich fixture);
  // run getInsight(productId); capture mockedInvokeLLM first call args;
  // parse the user message JSON; expect dealScore to equal
  // { score: expect.any(Number), band: expect.any(String), factors: expect.any(Object) }
  // with band "hot" for the falling fixture.
});

it("sends null dealScore for thin history", async () => {
  // getHistory returns [] or single point; snapshot present;
  // user message JSON has dealScore: null.
});

it("instructs consistency with the score", async () => {
  // run getInsight; system message contains "never contradict"
  // (assert the exact consistency sentence fragment).
});
```
Adapt to the file's actual fixture/product-id mechanics (read first — if tests use a real catalog id like a CRS part, reuse it).

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run tests/price-insights.test.ts 2>&1 | tail -4`
Expected: FAIL (3 new failures; existing pass).

- [ ] **Step 4: Commit the failing tests**

```bash
git add tests/price-insights.test.ts
git commit -m "test: guard grounded LLM insights"
```

---

### Task 2: Deal score in context + prompt line

**Files:**
- Modify: `server/price-insights.ts`

- [ ] **Step 1: Add import + context field**

Add `import { computeDealScore } from "../lib/deal-score";` (mirrors existing `../lib/*` imports in the file). In `buildInsightContext` return object, add:
```ts
    dealScore: computeDealScore(listings, "USD"),
```
(`listings` is the assembled `DistributorListing[]` in scope; `computeDealScore` returns null when thin — matches the null test. Currency "USD": the listings carry mixed native currencies and computeDealScore converts — verify this matches how the rest of the context treats prices (raw native + currency fields; score normalized to USD — acceptable, it's a normalized signal; note it, don't convert context prices.)

- [ ] **Step 2: Add the prompt sentence**

In `generateInsight` system content, append (exact):
`"A deterministic deal score is provided (0–100, band hot/fair/wait with factor breakdown); stay consistent with its verdict — never contradict it."`
(U+2013 en dash in "0–100" — copy exactly.)

- [ ] **Step 3: Verify**

Run: `pnpm vitest run tests/price-insights.test.ts` (all pass, incl. 3 new) and `pnpm check` (clean).

- [ ] **Step 4: Commit**

```bash
git add server/price-insights.ts
git commit -m "Feat: ground LLM insights in the deterministic deal score. TypeScript: 0 errors."
```

---

### Task 3: Full verification + push

**Files:** none (verification only)

- [ ] **Step 1: Lint + full suite**

`pnpm lint` (0 errors, no new warnings in touched files), `pnpm test` (all pass, 0 failures — DB-gated tests only under RUN_DB_TESTS per convention; do NOT set it).

- [ ] **Step 2: Push**

`git push origin main` (`main -> main`), `git status --short` empty.
(No desktop build needed — server-only change. Note why in the report.)

# Grounded LLM Insights — Design

Date: 2026-09-06. Scope: feed the deterministic deal score into
the LLM insight pipeline (approved; third of smart-insights
split).

## Problem

The LLM insight endpoint already writes buy/wait prose, but from
raw history alone — it can contradict the deterministic Deal
Score shown beside it (e.g. prose says "wait" while the badge
says "🔥 Hot deal"). No shared ground truth flows into the
prompt.

## Approach

Include the computed score in the prompt context with a
consistency instruction. Same cache, same endpoint, same UI.
No new endpoints, no client changes.

## Grounding

- `server/price-insights.ts` `buildInsightContext`: compute
  `computeDealScore(listings, "USD")` (import from
  `../lib/deal-score`; server already imports `../lib/*`
  including live currency — no new dependency class) over the
  already-assembled listings (zero extra fetches) and include
  `{ score, band, factors }` or `null` as `dealScore` in the
  returned context.
- System prompt gains exactly one sentence: "A deterministic
  deal score is provided (0–100, band hot/fair/wait with factor
  breakdown); stay consistent with its verdict — never
  contradict it."
- Cache key (`productId`) and TTL unchanged; prose and score
  regenerate together, so staleness stays coherent.

## Testing

- Unit tests: context includes score when computable and null
  otherwise; prompt contains the consistency line. LLM call
  mocked (mirror `tests/price-insights.test.ts` patterns —
  check first).
- No live-LLM tests. Verification: `pnpm check` (0 errors),
  `pnpm lint` (no new warnings), `pnpm test` (full suite
  green). DB-gated tests only under RUN_DB_TESTS (existing
  convention).

## Non-goals

- New endpoints, UI changes, prompt rewrites beyond the one
  line, client changes.

# Design: Centralize Blocked Detection (v4.7.2)

Date: 2026-08-16
Status: Approved

## Problem

`lib/scrapers/health.ts` `classifyResult` re-implements the same 4 Cloudflare/blocked markers inline
(`403 Forbidden`, `Access Denied`, `cf-browser-verification`, `Checking your browser`) that
`classifyFetchStatus` already owns in `lib/scrapers/resilient.ts`. Two copies of the marker list can
drift: adding a marker to one classifier silently misses it in the other.

## Approach

**A — `classifyResult` delegates to `classifyFetchStatus`.** `resilient.ts` remains the single owner
of blocked-marker detection. `health.ts` drops its inline marker list and asks the shared classifier.

## Changes

### `lib/scrapers/health.ts`

- Add `import { classifyFetchStatus } from "./resilient";`
- Replace the four inline `html.includes(...)` conditions in `classifyResult` with:

```ts
if (classifyFetchStatus(html) === "blocked") return "blocked";
```

- Keep the rest of `classifyResult` unchanged:
  - `error` present → `"error"`
  - blocked (via `classifyFetchStatus`) → `"blocked"`
  - `result && result.price > 0` → `"working"`
  - otherwise → `"error"`

`classifyFetchStatus(html)` is called without `httpStatus`; it returns `"ok" | "blocked"` based on
markers alone, so `=== "blocked"` is the only check needed. It is pure string matching and never
throws — error handling is unchanged.

### `lib/scrapers/resilient.ts`

One line: change `const BLOCKED_MARKERS` to `export const BLOCKED_MARKERS` so the regression test can
iterate the single source of truth. No behavioral change.

### Scope exclusions

- `testAllDistributors` keeps using `fetchWithParser`; routing the health probe through
  `resilientFetch` is a separate feature, not part of this change.
- No new files.

## Testing

- The 7 existing `classifyResult` tests in `tests/scrapers/health.test.ts` pass unchanged (they
  exercise the delegation through the public API).
- Add one regression test proving single-source-of-truth: iterate `BLOCKED_MARKERS` (exported from
  `resilient.ts`) and assert `classifyResult(marker, null)` returns `"blocked"` for each. This is the
  test that would have caught the drift — a marker added to the single source is automatically
  detected by `classifyResult` without touching `health.ts`.

## Verification

- `pnpm check` — 0 TypeScript errors
- `pnpm lint` — clean
- `pnpm test` — full suite green
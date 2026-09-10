# Dedup Bundle — Design Spec (2026-09-10)

Three pure-logic extractions. Behavior byte-identical everywhere except one explicit, already-conventional upgrade (§C Settings toast). No new UI language, no new packages. PillFilterRow/CatalogSort unification explicitly deferred (RN-vs-DOM split needs its own spec).

## §A — Shared logger (`lib/log.ts`, new)

```ts
export const LOG_ERROR: (...args: unknown[]) => void =
  typeof __DEV__ !== "undefined" && __DEV__ ? console.error.bind(console) : () => {};
```

- `typeof` guard keeps it safe where `__DEV__` is undeclared; dev behavior identical on RN (global) and desktop (vite `define` → `import.meta.env.DEV`).
- All 9 call sites (`app/product/[id].tsx`, `app/(tabs)/watchlist.tsx`, `app/compare/[id].tsx`, `components/product/price-chart-modal.tsx`, `components/settings/about-section.tsx`, `lib/_core/api.ts`, `lib/_core/auth.ts`, `lib/notifications.ts`, `desktop/src/pages/Stats.tsx`) drop the local const and import the shared one.
- Server `[Database]`/`[Sync]` console convention untouched.
- Tests: existing `silent-failures` guards updated to the import source; unit test for the pure recent-searches core covers §B (logger itself asserts shape/wiring only).

## §B — Recent-searches pure core (`lib/recent-searches.ts`)

```ts
export const MAX_RECENT_SEARCHES = 8;
export function addRecentSearch(list: string[], query: string): string[];
export function parseRecentSearches(raw: string | null): string[];
```

- Pure data functions: trim, case-insensitive dedup, unshift, cap; JSON-parse + string-filter, `[]` on garbage.
- Existing async `getRecentSearches/recordSearch/clearRecentSearches` reimplement on top; signatures unchanged; `tests/recent-searches.test.ts` passes unmodified.
- Desktop `Search.tsx` + `SearchModal.tsx` keep sync localStorage I/O, call the shared core — unifying cap/dedup/clear semantics across all three surfaces.
- Tests: unit tests for pure functions (whitespace, case-variant dupes, cap overflow, corrupt JSON); guard asserting both desktop files import the shared module.

## §C — Desktop share helpers (`desktop/src/lib/share.ts`, new)

```ts
export async function copyTextWithFallback(text: string): Promise<boolean>;
export async function saveNodeAsPng(node: HTMLElement, filename: string): Promise<void>;
```

- `copyTextWithFallback`: `navigator.clipboard.writeText` → textarea + `execCommand("copy")` fallback → boolean success. Replaces `Watchlist.tsx:441-460`, `Compare.tsx:414-432` pairs.
- `saveNodeAsPng`: `toPng(node)` → anchor download; throws on failure, callers toast. Replaces trios in `Compare.tsx`, `ProductDetail.tsx`, `Stats.tsx`.
- `Settings.tsx:1021` one-liner migrates; its bare `.catch(()=>{})` becomes caller-side toast (intended upgrade, matches error-paths convention).
- Helpers report, never notify — callers keep their own toasts.
- Tests: jsdom units for both paths of `copyTextWithFallback` (mocked clipboard + execCommand, failure → false); `saveNodeAsPng` with mocked `html-to-image`; guard: no `execCommand` outside `share.ts`.

## Non-goals

- PillFilterRow/CatalogSort unification; shared LOG_WARN (no copies exist); server logging changes; new packages; UI changes of any kind.

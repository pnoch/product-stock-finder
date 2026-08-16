# Design: Fast-Fail Browser-Unavailable on Client

- **Date:** 2026-08-16
- **Status:** Approved
- **Related:** `docs/superpowers/plans/2026-08-16-resilient-parser-fetch.md` (v4.7, complete)

## Problem

`lib/scrapers/resilient.ts` `fetchBrowser` does `await import("./browser")`. On mobile, the dynamic import fails (playwright is not resolvable in the RN bundle). `attemptMethod` treats that as a transient error and retries it twice with 1s/2s backoff — a ~3s penalty per `useBrowser` listing on the client fallback path, every check. The import failure is deterministic, so retrying is pure waste.

## Goal

Fast-fail deterministic browser-module import failures so the plain fallback runs immediately, while preserving retry semantics for transient browser *call* errors on the server.

## Changes (all in `lib/scrapers/resilient.ts`)

### 1. `BrowserUnavailableError`

New exported error class (extends `Error`) signaling the browser method cannot run at all. Exported so tests can throw it.

### 2. `fetchBrowser` — split import from call + cache failure

```ts
let browserUnavailableReason: string | null = null;

async function fetchBrowser(parser, url): Promise<string> {
  if (browserUnavailableReason) throw new BrowserUnavailableError(browserUnavailableReason);
  let mod;
  try {
    mod = await import("./browser");
  } catch (error) {
    browserUnavailableReason = "browser module unavailable";
    throw new BrowserUnavailableError(browserUnavailableReason, { cause: error });
  }
  return mod.fetchWithBrowser(url, parser.browserOptions);
}
```

The module-scope `browserUnavailableReason` cache means after the first failure, later calls skip the import attempt entirely.

### 3. `attemptMethod` — break retry loop on `BrowserUnavailableError`

The browser branch's catch checks `error instanceof BrowserUnavailableError` and `break`s the retry loop immediately (returns `error`, no 1s/2s sleeps). Transient browser call errors are still retried as before.

## Behavior After Fix

- **Client, first call** for a `useBrowser` parser: import fails instantly → `BrowserUnavailableError` → no retries → plain fallback immediately.
- **Client, subsequent calls:** import skipped via the cache.
- **Server:** unaffected — import succeeds; launch/navigation errors are transient and still retried.

## Testing (`tests/resilient-fetch.test.ts`)

- Mock `fetchWithBrowser` to throw `BrowserUnavailableError` → assert it is called exactly **once** (no retry), outcome is `error` with method `browser`, and plain fallback proceeds.
- Update the existing "falls back to plain when browser is unavailable" test to use `BrowserUnavailableError` instead of a generic error (it currently relies on the 3s retry path).

## Non-Goals

- No change to plain-path retries.
- No change to `lib/scrapers/browser.ts`.
- No launch-failure detection (string-matching error messages is fragile).
- No change to `fetchWithParser` (health.ts path).
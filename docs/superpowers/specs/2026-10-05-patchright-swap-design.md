# Patchright + System Chrome for the Server Browser Path — Design Spec

**Date:** 2026-10-05
**Goal:** Improve the server's ability to pass Cloudflare/anti-bot gates by swapping Playwright for Patchright and driving the system Chrome (real Chrome TLS/JA4 fingerprint), with a bundled-Chromium fallback.

## Problem

The server's Playwright path (`lib/scrapers/browser.ts`) is blocked by Cloudflare on several distributors (Winncom, B&H, GoWiFi). The 2026 anti-detect benchmark (7 tools × 31 Cloudflare targets × 3 sweeps) shows the gate keys on **automation-protocol fingerprinting** (Playwright's CDP handshake) and on the **client's TLS/JA4 shape**, not on `navigator.*` patches. Vanilla Playwright scored 24/31 OK; **Patchright** (a Playwright fork that patches CDP-leak signals) scored 25/31, and the benchmark found **`channel: "chrome"` (driving system Chrome) mattered more than the patches** because it delivers a real Chrome TLS/version shape.

## Scope

**In scope:** swap the server browser driver to `patchright`, launch with `channel: "chrome"` and fall back to bundled Chromium, update the web-bundle guard, CI, and `scripts/smoke-web.ts`.

**Out of scope:** the plain-HTTP path (`impit`/curl-impersonate) — deferred; the mobile WebView renderer and desktop Rust path — unchanged; managed scraping APIs / residential proxies — infrastructure, not code.

## Architecture

Only `lib/scrapers/browser.ts` and `scripts/smoke-web.ts` import the driver; the mobile (`browser-native.ts`), web (`browser.web.ts`), and desktop (Rust `playwright-rs`) paths do not. So the swap is contained to the server.

### 1. Dependency

`package.json`: remove `playwright`, add `patchright@^1.63.0`. `patchright` re-exports a Playwright fork with the identical API (`chromium`, `Browser`, `BrowserContext`), so the only change in `browser.ts` is the import specifier.

### 2. Launch with system Chrome + fallback

In `BrowserPool.acquire`, launch with `channel: "chrome"` and fall back to the bundled Chromium if system Chrome is absent:

```ts
async function launchBrowser(): Promise<Browser> {
  const args = [
    "--disable-blink-features=AutomationControlled",
    "--disable-dev-shm-usage",
    "--no-sandbox",
    "--disable-web-security",
    "--disable-features=IsolateOrigins,site-per-process",
  ];
  try {
    return await chromium.launch({ headless: true, channel: "chrome", args });
  } catch {
    // System Chrome not installed — use patchright's bundled Chromium.
    return await chromium.launch({ headless: true, args });
  }
}
```

`acquire` calls `launchBrowser()` in place of the current `chromium.launch({...})`.

### 3. Guard

`tests/scrapers/browser-web.test.ts`: rename the "playwright web-bundle guard" to a driver guard that (a) allows `patchright` only in `lib/scrapers/browser.ts`, (b) asserts no source imports `playwright`, and (c) keeps the `browser.web.ts` stub check.

### 4. CI

`.github/workflows/ci.yml`: replace `npx playwright install --with-deps chromium` with `npx patchright install --with-deps chromium` (patchright's CLI). CI exercises the bundled fallback; optionally install `google-chrome-stable` to exercise `channel: "chrome"`.

### 5. Smoke script

`scripts/smoke-web.ts`: import `chromium` from `patchright`.

## Error Handling

- `channel: "chrome"` failure (Chrome absent) → bundled Chromium, no user-visible change.
- Both launches fail → the existing `Failed to launch browser` error path (unchanged).
- No behavior change to the pool, stealth context, cookie jar, or parsers.

## Security & Privacy

- No new data flows; the driver still runs headless and only loads parser-derived URLs.
- `patchright` is Apache-2.0 and actively maintained; `channel: "chrome"` uses the host's own Chrome binary.

## Testing

- `tests/scrapers/browser-launch.test.ts` (new): with `chromium.launch` mocked to throw on `channel: "chrome"` and succeed without it, `acquire()` returns the bundled browser; with `channel: "chrome"` succeeding, it is used.
- `tests/scrapers/browser-web.test.ts` (updated): the driver guard.
- Existing parser/resilient tests are unaffected (they mock HTML, not the driver).
- Device/CI note: the real Cloudflare pass-rate gain is only measurable against live targets; the change is behavior-preserving locally.

## Risks & Mitigations

- **`channel: "chrome"` needs Chrome on the host** → fallback to bundled Chromium.
- **Fork maintenance** → patchright is actively released (1.63.0) and API-compatible; the guard pins the import to one file.
- **The hardest Turnstile sites still won't pass** → those need nodriver-class control planes or a managed API; this is a free, contained improvement, not a complete solution.

## Success Criteria

- The server launches via `channel: "chrome"` when Chrome is present, else bundled Chromium.
- No source imports `playwright`; the guard passes; `pnpm verify` stays green.
- Live Cloudflare-blocked distributors pass more often than with vanilla Playwright (measured against real targets, not in CI).

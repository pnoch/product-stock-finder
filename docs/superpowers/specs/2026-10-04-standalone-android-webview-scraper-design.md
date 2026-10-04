# Standalone Android Price Refresh (WebView Renderer) — Design Spec

**Date:** 2026-10-04
**Goal:** Make price refresh work for all 25 distributor parsers on Android with no backend by rendering JS / Cloudflare-protected distributor pages in a hidden on-device WebView and feeding the rendered HTML to the existing parsers unchanged.

## Problem

The app is local-first, but on a device with no backend only the ~8 server-rendered parsers produce prices. The other 17 set `useBrowser: true` because their pages either require JS execution or sit behind a Cloudflare/JS challenge. On Android, `scripts/metro-resolver.js` redirects `lib/scrapers/browser` to `lib/scrapers/browser.web.ts`, whose `fetchWithBrowser` always throws `BrowserUnavailableError`, so `resilient.ts` falls through to plain HTTP and those sites return nothing.

Recon (2026-10-04) of the 17 browser-dependent search URLs with a desktop Chrome UA:

- **Hard-blocked to plain HTTP (403 / Cloudflare "Just a moment"):** `nasstore-eu`, `winncom-us`, `bhphoto-us`, `wisp-au`, `pbtech-nz`, `gowifi-nz`, `networkdevices-us` — a JSON/XHR connector cannot reach them; only a real browser passes the challenge.
- **Reachable (200) with a price in HTML/JSON:** `multilink-us`, `neobits-us`, `getic-gr`, likely `miro-za` / `linktechs-us`.
- **Reachable but price is JS-only:** `aerial-gr`, `hellascom-gr`, `rocnoc-us`, `mbsiwav-ca`, `100mega-cz`.

Conclusion: per-site plain-HTTP API connectors cannot satisfy "all distributors"; a real browser is required for at least the 7 blocked sites. The renderer below covers all 25 in the foreground. Plain-HTTP JSON connectors for the reachable subset remain a possible later optimization (faster + background-capable), not part of this work.

## Scope

**In scope:** an on-device WebView fetch layer that satisfies `fetchWithBrowser(url, opts): Promise<string>` with rendered HTML, so `resilient.ts` + all existing parsers work unchanged. Foreground only.

**Out of scope (YAGNI):**
- Background rendering. `expo-background-task` runs headless with no view tree; background checks stay plain-HTTP. No foreground service.
- Per-site JS extractors — we reuse the parsers' HTML extraction.
- Alerts / reminders / restock watches / compare / stats — already local; they only need prices.
- Sync / shared watchlists / server push — inherently server-side.
- iOS-specific work beyond platform parity (the module is platform-neutral; Android is the target).

## Architecture

Add `react-native-webview` (Expo-supported; needs `expo prebuild` + a new APK).

**`lib/scrapers/webview-host.ts`** — a framework-free controller singleton:

```ts
export interface WebViewHost {
  load(url: string, opts?: { waitForSelector?: string; timeoutMs?: number }): Promise<string>;
}
export function setWebViewHost(host: WebViewHost | null): void; // called by the React host on mount/unmount
export function getWebViewHost(): WebViewHost | null;
```

**`components/webview-fetch-host.tsx`** — mounted once in `app/_layout.tsx`. Owns one hidden `<WebView>` (`width/height 0`, `pointerEvents="none"`, `androidLayerType="software"`) and an internal one-at-a-time queue. Per request:

1. `source={{ uri }}`; await `onLoadEnd` (or `onError`).
2. If `waitForSelector`, poll via `injectedJavaScript` (`document.querySelector(sel)`) until present or the timeout elapses.
3. Short settle delay (~500ms) for late XHR price injection.
4. Read `document.documentElement.outerHTML` through an `injectedJavaScript` + `window.ReactNativeWebView.postMessage` bridge; resolve with the HTML.
5. On timeout/error, reject; move to the next queued request.

`setWebViewHost(controller)` on mount, `setWebViewHost(null)` on unmount.

**`lib/scrapers/browser-native.ts`** — same export surface as `lib/scrapers/browser.ts`:

```ts
export const browserPool = { acquire/release/shutdown: no-op or throw BrowserUnavailableError };
export async function fetchWithBrowser(url, options?): Promise<string>; // delegates to getWebViewHost(); throws BrowserUnavailableError when absent
export async function teardownBrowserSession(...): Promise<void>; // no-op
```

It imports `BrowserUnavailableError` from `./resilient` (as `browser.web.ts` does).

**`scripts/metro-resolver.js`** — for `ios`/`android`, redirect `./browser` → `browser-native.ts`; for `web`, keep `browser.web.ts`. Playwright stays out of every Expo bundle. Server/desktop resolution is unaffected (they resolve `browser.ts` directly, not through Metro).

## Data Flow

`resolvePrice` → `scrapePriceOnDevice` → `fetchAndParse(parser, model, breakerStore)` → `methods = parser.useBrowser ? ["browser","plain"] : ["plain","browser"]` → `attemptMethod("browser")` → `fetchWithBrowser(url, parser.browserOptions)` → hidden WebView renders → HTML → `parser.parsePrice(html, model, url)` → `ScrapeResult` → stored to listings/history. No parser or `resilient.ts` change.

## Error Handling

- No host mounted (background task / before `_layout` mounts) → `fetchWithBrowser` throws `BrowserUnavailableError` → `resilient` falls to plain HTTP (background behaviour unchanged).
- Timeout / WebView error / `onHttpError` → request rejects → browser attempt fails → plain fallback; breaker records the outcome as today.
- The device-scrape semaphore (`MAX_CONCURRENT_DEVICE_SCRAPEES = 3`) bounds concurrency; the host queue serializes rendering. If the queue exceeds a cap (e.g. 25), new requests reject immediately with `BrowserUnavailableError` to avoid unbounded waits.
- The hidden WebView never receives user interaction; a hard navigation error must not leak into the UI.

## Testing

- **Controller** (`webview-host.test.ts`): `getWebViewHost()` null by default; `fetchWithBrowser` rejects with `BrowserUnavailableError` with no host; delegates to a fake host when set.
- **Host queue** (`webview-fetch-host.test.tsx`, jsdom with a mocked `react-native-webview` that can fire `onLoadEnd`/`onMessage`): serializes requests, resolves with the posted HTML, times out a stalled page, rejects on `onError`, advances the queue.
- **Surface parity** (`tests/scrapers/browser-web.test.ts`, updated): native redirect target is `browser-native.ts`; web target is `browser.web.ts`; only `browser.ts` statically imports `playwright`; `react-native-webview` is referenced only by `browser-native.ts`/the host (not the web stub).
- **Regression:** existing parser fixture tests and `resilient` tests remain green (no signature changes).

## Risks & Mitigations

- **Cloudflare may still challenge the System WebView.** A real Chrome-based WebView passes more often than plain HTTP but is not guaranteed; the in-app Health dashboard will show which distributors still fail. Mitigation path: add JSON connectors for sites that expose them.
- **Battery/CPU:** rendering is heavier than HTTP; bounded by the queue, the device semaphore, and foreground-only use (launch / pull-to-refresh / Test All).
- **APK size:** `react-native-webview` adds a small JS/native wrapper; the OS WebView engine is already present.
- **Consent/age gates:** some EU sites gate the price behind a consent banner. The host may inject a best-effort dismissal (click elements matching common consent labels) before extracting; validate per-site and keep it generic (no per-parser coupling).

## Success Criteria

- With no backend configured (`isServerConfigured()` false), a foreground refresh of a product fetches prices from distributors that previously required the browser, including at least some of the 7 Cloudflare-blocked sites.
- `pnpm verify` stays green; no Playwright in any Expo bundle; background behaviour unchanged (plain-only).

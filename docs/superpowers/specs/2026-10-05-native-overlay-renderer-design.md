# Native Overlay WebView Renderer (hybrid) — Design Spec

**Date:** 2026-10-05
**Goal:** Render browser-dependent distributor pages while the app is backgrounded, by extracting HTML in a native Kotlin `WebView` attached to an offscreen overlay window — so the frozen React Native JS bridge can't stall it.

## Problem

The foreground-service spike (Phase 1101) proved the FGS keeps the process alive but **not** the RN↔WebView bridge: while backgrounded, `onShouldStartLoadWithRequest` timed out (`Did not receive response ... defaulting to allow loading`) and `onMessage` is equally throttled, so the React hidden-WebView host cannot extract HTML. Background coverage was unchanged.

## Solution

A native Kotlin renderer that owns its own `WebView` on a real (invisible) window and does the DOM extraction **natively** via `evaluateJavascript`, never touching the RN JS bridge. It is used only when the React host is unavailable (background); the foreground keeps the proven React pool.

## Scope

**In scope:** a local Expo module (`modules/psf-webview-renderer/`) with an overlay-window `WebView` renderer; hybrid dispatch in `browser-native.ts`; the `SYSTEM_ALERT_WINDOW` permission (reversing the Phase-1086 removal) + a Settings grant flow; a gating device spike.

**Out of scope:** replacing the foreground React host; iOS (no overlay windows); a service-driven scheduler (the existing `expo-background-task` remains the trigger).

## Architecture

### 1. Local Expo module `modules/psf-webview-renderer/`

- `android/src/main/AndroidManifest.xml` — declares `android.permission.SYSTEM_ALERT_WINDOW`.
- `OverlayRenderer.kt` — lazily creates one `WebView` (non-incognito, `javaScriptEnabled`, `domStorageEnabled`) and attaches it to a `WindowManager` overlay: `TYPE_APPLICATION_OVERLAY`, 1×1 px, `x/y` offscreen, `FLAG_NOT_FOCUSABLE | FLAG_NOT_TOUCHABLE`, `PixelFormat.TRANSLUCENT`. A real window keeps the WebView's JS running while the app is backgrounded.
- `render(url, options)` — serialized queue:
  1. `webView.loadUrl(url)`.
  2. Poll natively: `webView.evaluateJavascript("!!document.querySelector(<json sel>)", cb)` every ~250 ms until true or the timeout.
  3. `webView.evaluateJavascript("document.documentElement.outerHTML", cb)` → resolve the HTML.
  - `waitForSelector` optional; a settle delay (~500 ms) after the selector appears.
- `isOverlayGranted()` → `Settings.canDrawOverlays(context)`.
- `requestOverlay()` → `Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:<pkg>"))`.
- `src/index.ts` (JS API): `render(url, opts)`, `isOverlayGranted()`, `requestOverlay()` — no-ops/`false` off Android.
- `expo-module.config.json`.

### 2. Hybrid dispatch — `lib/scrapers/browser-native.ts`

```ts
export async function fetchWithBrowser(url, options) {
  const host = getWebViewHost();
  if (host) return host.load(url, options);           // foreground: React pool
  return renderOverlay(url, options);                 // background: native overlay
}
```

`renderOverlay` throws `BrowserUnavailableError` when the module is unavailable or the overlay permission is not granted, so `resilient` falls back to plain HTTP (unchanged behavior when unpermitted).

### 3. Permission + hardening

- `plugins/with-android-hardening` currently removes `SYSTEM_ALERT_WINDOW`; change it to **not** remove it (the renderer module declares it). Update its test.
- Settings → **Background refresh**: on enable, if `!isOverlayGranted()`, call `requestOverlay()` and show a status line ("Allow 'draw over other apps' to refresh in the background"). The toggle's effect is only meaningful once granted; the FGS still starts (harmless).

### 4. Data flow

1. App backgrounded; FGS keeps the process alive.
2. `expo-background-task` runs `runPriceCheckCore` → `resolvePrice` → `scrapePriceOnDevice` → `fetchWithBrowser`.
3. `getWebViewHost()` is null (no React tree) → `renderOverlay(url, opts)` → the overlay WebView loads the page, waits for the selector, extracts `outerHTML` natively → HTML → `parser.parsePrice` → price stored.
4. Foreground: `getWebViewHost()` is non-null → the React pool handles it exactly as today.

## Error Handling

- Module missing / permission denied → `BrowserUnavailableError` → plain-HTTP fallback.
- Render timeout → reject → plain fallback; the breaker records the outcome.
- The overlay window is created lazily and reused; it is destroyed when the module is torn down.
- `requestOverlay()` failure (no activity) → the status line explains the manual path (system Settings).

## Security & Privacy

- `SYSTEM_ALERT_WINDOW` is sensitive: the overlay is 1×1, non-focusable, non-touchable, and offscreen — it cannot intercept touches or display content. Documented in Settings.
- The overlay WebView is non-incognito, so it shares the app-wide cookie/DOM storage with the assist modal and the React host (sessions carry).
- Only parser-derived URLs are loaded (never user input).

## Testing

- `tests/foreground-service-module-guard.test.ts` (extend) — the renderer module manifest declares `SYSTEM_ALERT_WINDOW`; the hardening plugin no longer removes it.
- `tests/scrapers/browser-native-overlay.test.ts` — dispatch: React host used when present; overlay when absent; `BrowserUnavailableError` when neither.
- `tests/settings-background-service.test.ts` (extend) — the enable flow requests the overlay when not granted.
- **Device spike (gating):** background the app, run a browser-only fetch, confirm a price renders via the overlay. If it fails, stop and report.

## Risks & Mitigations

- **Play policy / user friction** for `SYSTEM_ALERT_WINDOW` → the overlay is invisible and non-interactive; the permission is only needed for background refresh; foreground works without it.
- **OEMs kill overlay windows** → the spike validates; a failed render falls back to plain HTTP.
- **Larger native surface** → one focused module, serialized, reused.

## Success Criteria

- With background refresh enabled and the overlay permission granted, a browser-only distributor's price updates while the app is closed (verified in the spike).
- Foreground rendering is unchanged and needs no permission.
- `pnpm verify` stays green; no new third-party dependency.

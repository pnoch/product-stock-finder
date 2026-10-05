# On-Device Session Assist ("Unlock this site") — Design Spec

**Date:** 2026-10-05
**Goal:** Let the user defeat anti-bot challenges and log into distributor accounts on-device, so price/stock fetch works for the distributors that block automated requests — without a backend.

## Problem

The on-device WebView renderer (`lib/scrapers/browser-native.ts` + `components/webview-fetch-host.tsx`) makes browser-only distributors work standalone, but on real devices several still fail: Cloudflare-gated sites (`blocked by site`) and login-gated B2B sites (`no price found`). A headless WebView cannot solve an interactive challenge or sign in. The user can — if we give them a visible browser once and reuse the resulting session.

Emulator evidence (Phase 1098): `working 9-10`, `blocked 6-8`, `error (no price) 8-9` of 25; the Cloudflare set is stochastic and untunable server-side.

## Scope

**In scope:** a user-driven "unlock" flow that opens a visible on-device browser for one distributor, lets the user solve a challenge and/or log in, and reuses that session (cookies) for subsequent automated fetches. Contextual entry from Health; a Settings section to explain and clear.

**Out of scope (YAGNI / follow-ups):**
- Per-domain cookie clearing (needs `@react-native-cookies/cookies`); v1 clears *all* site data.
- `localStorage`/JS-state auth (cookies only carry between the assist and pooled WebViews); fallback is a per-distributor persistent WebView if a specific site needs it.
- Server-side use of the user's session (this is on-device only).
- Auto-popup on block (manual action only).

## Architecture

The assist relies on **Android's system CookieManager** being shared between WebViews: the assist WebView and the hidden fetch pool are both non-incognito, so cookies (`cf_clearance`, login session) set during the assist are sent on later automated fetches to the same domain, and persist across app restarts. No cookie capture/injection code.

**New module `lib/scrapers/session-assist.ts`** (framework-free, unit-testable):

```ts
export function distributorHost(parser: DistributorParser): string;   // hostname of baseUrl
export function assistUrl(parser: DistributorParser): string;         // parser.baseUrl
export function isAssistCandidate(status: string | null | undefined, reason?: string | null): boolean; // blocked, or a no-price error
export function clearSiteData(): Promise<void>;                       // WebView cache + cookies (best-effort)
```

`isAssistCandidate` maps the health/probe status (`working | blocked | error`) plus its reason to the unlock action: `true` for `blocked`, and for `error` only when the reason indicates a price miss (`no price found`); `false` for `working`, unknown, or other errors.

**New component `components/session-assist-modal.tsx`** — a full-screen `Modal` containing a visible `<WebView>`:

- Props: `{ visible, parser, title, onClose, onDone }`.
- Non-incognito, hardware layers (default), `originWhitelist ["https://*"]`, and `onShouldStartLoadWithRequest` allowing only `http(s):`/`about:` (reused rule) so a distributor page cannot launch `intent://`/`market://`/`tel:`.
- Header: the distributor's name, a subtitle ("Sign in or complete the check, then tap Done"), and **Done** / **Close** buttons; a thin loading bar on `onLoadStart`→`onLoadEnd`.
- Source URL = `assistUrl(parser)` (the distributor's own base URL), never user input.
- **Done** → `onDone()` (the screen re-probes); **Close** → `onClose()`.

**Health re-probe.** `HealthService` gains:

```ts
testDistributor(parserId: string, onProgress?): Promise<DistributorHealth | null>;
```

(`createHealthService` currently exposes only `testAllDistributors`.) It runs the same probe for one parser and records a health sample, reusing the existing single-flight guard and breaker store.

**`app/health.tsx`** renders an "Open & unlock ↗" affordance on each distributor row whose status `isAssistCandidate(...)`; tapping it opens the modal for that parser. The modal's `onDone` calls `testDistributor(parser.id)`, then updates the row's status in place (and the working/blocked/error counts).

**`components/settings/site-sessions-section.tsx`** — a Settings section: explains that sign-in/challenge sessions are stored only on this device (app-private WebView storage, never synced), plus a **Clear all site data** button that calls `clearSiteData()` and confirms. (v1 is global; per-domain is a noted follow-up.)

## Data Flow

1. Health lists a distributor as `blocked`/`no price` → row shows "Open & unlock".
2. Tap → `SessionAssistModal` opens `assistUrl(parser)` visibly.
3. User solves Cloudflare and/or logs in → cookies land in the system CookieManager.
4. Tap **Done** → `testDistributor(parser.id)` runs; the hidden fetch pool loads the same domain with the warmed cookies → the probe records `working` and, on the product side, the listing price/stock updates on the next refresh.
5. Session persists (CookieManager on disk) for all future fetches; if it expires, the row returns to `blocked`/`no price` and the action re-appears.

## Error Handling

- Non-web navigations blocked by `onShouldStartLoadWithRequest`; WebView `onError`/`onHttpError` are non-fatal (the page may recover), matching the hidden host.
- Closing the modal without Done changes nothing (the user can retry).
- `testDistributor` failure is logged (existing `log.error`) and leaves the prior status.
- `clearSiteData` is best-effort (no throw); UI shows a toast either way.

## Security & Privacy

- Assist URLs are derived only from `parser.baseUrl`; no free-form URL entry.
- Sessions stay in app-private WebView storage — never AsyncStorage, sync, or the server.
- The modal header states the user is on the distributor's own site, so signing in is understood.
- Settings exposes a clear action and a one-line privacy note.

## Testing

- `tests/scrapers/session-assist.test.ts` — `distributorHost` (hostname extraction), `assistUrl`, and `isAssistCandidate` (blocked → true; error with a "no price found" reason → true; error with another reason → false; working/unknown → false).
- `tests/session-assist-modal.test.tsx` (jsdom, mocked `react-native-webview`/`react-native`) — renders the WebView at `assistUrl(parser)`; Done/Close invoke the callbacks; the scheme guard allows `https:` and blocks `intent://`.
- `tests/session-assist-health-guard.test.ts` — source guard: the health screen renders the unlock affordance for candidate rows.
- `testDistributor` — a unit test with a mocked adapter asserts it records a sample for the requested parser and reuses the single-flight guard.
- Device note: cookie carry-over from assist → hidden pool is verified on the emulator (not unit-testable).

## Risks & Mitigations

- **Cloudflare may still re-challenge** even a real WebView; the action simply reappears. Acceptable.
- **`localStorage`-based auth** won't carry to the pooled WebViews (cookies only). Mitigation: per-distributor persistent WebView (approach C) if a specific site needs it.
- **Session lifetime** varies; expiry re-surfaces the action.
- **Cookie clearing is global in v1** — documented; per-domain clear is a follow-up.

## Success Criteria

- On a device, a `blocked`/`no price` distributor can be opened visibly, the user completes the challenge/login, and after Done the distributor re-probes to `working` (or the product row shows a price) — with the session reused automatically on later fetches.
- No session data leaves the device; Settings can clear it.
- `pnpm verify` stays green; no new runtime dependency.

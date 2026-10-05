# Session Manager (per-domain clear + expiry) — Design Spec

**Date:** 2026-10-05
**Goal:** Complete the on-device session-assist feature: sign out of a single distributor (cookies + DOM storage), show which distributors have a session, and surface an expired session so the user can unlock it again.

## Problem

The session assist (Phase 1099) lets a user unlock a distributor in a visible WebView and reuses that session for automated fetches. Two limits remain:
- **Clearing is global** — `clearSiteData()` clears *all* cookies; there is no way to sign out of one distributor.
- **Expiry is invisible** — when a warmed session lapses, the distributor silently returns to `blocked`/`no-price` with no hint that unlocking again would fix it.

## Scope

**In scope:** a per-distributor **Clear** (cookies + `localStorage`/`sessionStorage`), a persisted **unlocked set** (intent, not inferred), a **Site sessions** manager in Settings listing relevant distributors with an Active/Expired/None hint and Open & unlock / Clear actions, and an **Expired — unlock again** label derived from the unlocked set + latest probe.

**Out of scope (separate specs):** background rendering (foreground service), per-site parser coverage.

## Architecture

### 1. Unlocked-set store — `lib/scrapers/session-store.ts` (new, framework-free)

```ts
export async function getUnlocked(): Promise<Record<string, string>>; // id -> ISO timestamp
export async function markUnlocked(id: string): Promise<void>;
export async function clearUnlocked(id: string): Promise<void>;
export async function clearAllUnlocked(): Promise<void>;
```

Backed by AsyncStorage key `session_unlocked` (JSON object). We persist **intent** (the user unlocked this distributor) rather than inferring from cookies, because distributor sites set analytics/consent cookies regardless of login. Uses the existing `lib/storage` AsyncStorage wrapper.

### 2. Per-domain clear — extend `lib/scrapers/session-assist.ts`

```ts
export async function clearDistributorSession(parser: DistributorParser): Promise<void>;
```

- **Cookies:** `CookieManager.get("https://" + distributorHost(parser))`, then `CookieManager.set(url, { ...cookie, expires: "1970-01-01T00:00:00.000Z" })` for each. (The library's `clearByName` is iOS-only; expiring via `set` works on Android.)
- **DOM storage:** `getWebViewHost()?.clearStorage(assistUrl(parser))` — a host job that loads the origin and runs `localStorage.clear(); sessionStorage.clear()`.
- Then `clearUnlocked(parser.id)`.
- Best-effort: each step in its own try/catch; never throws.

`clearSiteData()` (global) becomes: `CookieManager.clearAll()` + `clearStorage` for every origin in `getUnlocked()` + `clearAllUnlocked()`.

### 3. Host capability — `lib/scrapers/webview-host.ts` + `components/webview-fetch-host.tsx`

Add to `WebViewHost`:

```ts
clearStorage(url: string): Promise<void>;
```

The component implements it as a normal queued job with a dedicated injected script that clears storage and posts a sentinel:

```js
(function(){ try { localStorage.clear(); sessionStorage.clear(); } catch(e){} window.ReactNativeWebView.postMessage("__psf_storage_cleared__"); })(); true;
```

The host resolves the job when `onMessage` receives the sentinel (reusing the per-request id guard), or rejects on timeout/error. `requireWebViewHost()` throws `BrowserUnavailableError` when no host is mounted (background) — the caller treats that as "DOM clear skipped".

### 4. Settings "Site sessions" manager — rewrite `components/settings/site-sessions-section.tsx`

- Loads `getUnlocked()` + `healthService.getDistributorHealth()`.
- **Relevant** rows = distributors that are unlocked **or** whose latest status is `blocked`/`no-price` (`isAssistCandidate`); a **Show all 25** toggle lists every parser.
- Each row: `CC Name`, a session hint, the last status/reason, and **Open & unlock** (opens `SessionAssistModal`) + **Clear**.
- Session hint: **Active** (unlocked and last status `working`), **Expired — unlock again** (unlocked and last status `blocked`/`no-price`), **None** (not unlocked).
- Global **Clear all sessions** stays.
- After Clear/Unlock, refresh the list.

### 5. Health screen — `app/health.tsx`

On assist **Done**, call `markUnlocked(parserId)` alongside the existing `testDistributor(parserId)` re-probe. (The row's Unlock action already exists.)

## Data Flow

1. User taps **Unlock** on a blocked distributor → assist modal → **Done** → `markUnlocked(id)` + `testDistributor(id)` → row updates.
2. Settings → **Site sessions** shows the distributor as **Active** (or **Expired** if the re-probe still fails).
3. **Clear** → cookies expired + DOM storage cleared at that origin + `clearUnlocked(id)` → hint becomes **None**.
4. **Clear all sessions** → all cookies + every unlocked origin's DOM storage + `clearAllUnlocked()`.

## Error Handling

- Every clear step is best-effort; a failed DOM clear (offline, no host) still clears cookies and the unlocked flag, and the UI reports "Cleared (cookies only)".
- `clearStorage` rejects on timeout → the caller logs and continues.
- The manager tolerates missing health data (shows **None**/status unknown).

## Security & Privacy

- Clearing only ever targets origins derived from `PARSERS` (`assistUrl`), never user input.
- The unlocked set is a list of distributor ids + timestamps — no secrets — and stays on-device (AsyncStorage), never synced.
- Cookie values are never read into app state; they are only expired in place.

## Testing

- `tests/scrapers/session-store.test.ts` — CRUD over a mocked AsyncStorage.
- `tests/scrapers/session-assist-clear.test.ts` — `clearDistributorSession` expires cookies (mock cookie lib) and calls `clearStorage` (fake host) + `clearUnlocked`; tolerates a missing host.
- `tests/webview-fetch-host.test.tsx` — `clearStorage` resolves when the WebView posts the sentinel, rejects on timeout, and is serialized with fetches.
- `tests/site-sessions-section.test.tsx` — relevant filter + Show all, Active/Expired/None hints, Clear and Open actions.
- `tests/session-assist-health-guard.test.ts` — source guard: `markUnlocked(` is called in the Health Done handler.
- Device note: verify per-domain Clear signs out one distributor (cookies + localStorage) on the emulator.

## Success Criteria

- A user can sign out of a single distributor from Settings; its session hint returns to **None** and a subsequent probe behaves as a fresh session.
- A distributor whose session lapsed shows **Expired — unlock again**; unlocking restores **Active**.
- `pnpm verify` stays green; no new runtime dependency.

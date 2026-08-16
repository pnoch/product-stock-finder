# Resilient Parser Fetch — Design

**Date:** 2026-08-16
**Status:** Approved design (pending implementation plan)

## 1. Overview

The app already has live distributor price feeds: 25 `DistributorParser`s in `lib/scrapers/` (16 use the Playwright stealth browser, 9 plain HTTP), a server-side price cache + 90-day history with a 1h TTL and a 5-min warmer, a `prices.get` tRPC endpoint, and a server-first-with-local-fallback refresh path. What it lacks is **resilience**: a single transient failure marks a distributor "error" for that cycle, blocked sites are re-hit every cycle, and health data is recorded but never acted upon.

This phase adds a shared resilient fetch layer that both the server path (`server/prices.ts` `refreshPrice`) and the client fallback path (`lib/background-price-check.ts` `refreshListing`) use. It provides:

1. **Retry with backoff** on transient errors (network failure, timeout, 5xx).
2. **Plain → stealth-browser escalation** when a site blocks plain HTTP (403/429/Cloudflare).
3. **Per-distributor circuit breaker** — cooldown after definitive blocks or repeated failures, so dead sites stop being hit every cycle.
4. **Robust blocked detection** keyed off HTTP status codes as well as HTML content.
5. **Health state that is acted upon** — the breaker state feeds the existing `distributor_health` surface and drives skip behavior.

Both paths already share `lib/scrapers/`, so a shared layer fixes both consistently.

## 2. Architecture

### New module: `lib/scrapers/resilient.ts`

```ts
type FetchStatus = "ok" | "blocked" | "error" | "skipped";

interface FetchOutcome {
  html?: string;
  status: FetchStatus;
  method: "plain" | "browser" | "none";
  error?: string;
}

interface BreakerEntry {
  distributorId: string;
  status: "working" | "blocked" | "error";
  consecutiveFailures: number;
  lastAttemptAt: number;
  cooldownUntil: number; // 0 = none
  reason?: string;
}

interface BreakerStateStore {
  get(distributorId: string): Promise<BreakerEntry | null>;
  set(entry: BreakerEntry): Promise<void>;
}

interface ResilientFetchOptions {
  parser: DistributorParser;
  url: string;
  state: BreakerStateStore;
  now?: () => number;
  maxRetries?: number; // default 2
  retryBaseMs?: number; // default 1000
  blockedCooldownMs?: number; // default 30 min
  failureCooldownMs?: number; // default 15 min
  failureThreshold?: number; // default 3
  maxCooldownMs?: number; // default 2h
}

async function resilientFetch(opts: ResilientFetchOptions): Promise<FetchOutcome>;
```

### Flow

```
resilientFetch({ parser, url, state })
  │
  ├─ 1. Breaker check → "skipped" (no site hit) if cooldownUntil > now
  ├─ 2. Attempt plain HTTP (rate-limited, captures status)
  │      ├─ ok        → record success → return { html, status: "ok" }
  │      ├─ blocked   → escalate to browser (once, if available)
  │      │               ├─ ok     → record success → return { html, status: "ok", method: "browser" }
  │      │               └─ blocked→ record failure + cooldown → return { status: "blocked" }
  │      └─ transient → retry with backoff (up to maxRetries)
  │                     → then record failure (cooldown after threshold) → return { status: "error" }
```

### Breaker state backends

- **Client:** `createBreakerState(AsyncStorage)` — persists under a new `distributor_breaker` key as a `BreakerEntry[]` array. The existing `distributor_health` key and health screen are unchanged; the refresh path still records health via the existing `healthCollector` (status derived from `resilientFetch` outcomes).
- **Server:** in-memory `Map` (same pattern as `price-cache.ts`'s memory fallback).

### Integration points (both swap `fetchWithParser` → `resilientFetch`)

- `server/prices.ts:35` `refreshPrice` — server breaker store; on `"skipped"`/`"blocked"`/`"error"` → return `null`, stale cache stays.
- `lib/background-price-check.ts:115` `refreshListing` — client breaker store; feeds the existing health collector (`healthCollector.record`).
- The warmer inherits the breaker automatically (it flows through `refreshPrice` → `refreshSingleFlight`).

### Required refactor

`fetchWithRateLimit` (`lib/scrapers/utils.ts:64`) currently throws on non-OK responses, so it cannot distinguish 403/429 from other errors. `resilientFetch` needs its own status-capturing fetch that keeps the existing rate-limit + UA rotation behavior. `fetchWithParser` remains for any callers that do not need resilience.

## 3. Retry & Escalation Policy

**Transient errors** (network failure, timeout, 5xx):
- Retry up to **2 times** with exponential backoff: 1s, then 2s (`retryBaseMs`).
- Never retry on a definitive blocked response (403/429/Cloudflare).

**Blocked detection** — centralized in one classifier (replacing the duplicated string-matching in `health.ts:19` and `background-price-check.ts:142`), keyed off:
- HTTP status codes: `403`, `429`
- HTML markers: `403 Forbidden`, `Access Denied`, `cf-browser-verification`, `Checking your browser`

**Escalation rules:**
- Parsers already marked `useBrowser: true` start at browser (no plain attempt first) — unchanged behavior.
- Plain-HTTP-only parsers escalate to the stealth browser once when blocked.
- If Playwright is unavailable (e.g. mobile), fall back to plain HTTP (existing `fetchWithParser` behavior); the breaker still records the outcome.

## 4. Circuit Breaker & Health State

**Cooldown rules:**
- Definitive block → `cooldownUntil = now + 30 min` (`blockedCooldownMs`).
- Repeated transient failures → after 3 consecutive failures (`failureThreshold`), enter cooldown for 15 min (`failureCooldownMs`).
- Any success → reset `consecutiveFailures = 0`, clear cooldown, status `working`.

**Re-probe:** when `cooldownUntil` passes, the next request is allowed through as a probe. Success resets the breaker; failure extends the cooldown with a multiplier (e.g. 30 → 45 min), capped at 2h (`maxCooldownMs`).

**Skip behavior:** while in cooldown, `resilientFetch` returns `"skipped"` immediately — no site hit. Callers keep the last known (stale) price. This stops the server warmer and client refresh from wasting requests on dead sites.

**Health surface:** the existing `distributor_health` list (health screen + distributor-analysis) continues to reflect per-check outcomes via the existing health collector — `blocked`/`error` entries show the reason as today. The breaker state itself is internal to the fetch layer in this phase (not surfaced in the health screen); surfacing cooldown/counters is out of scope.

## 5. Error Handling & Edge Cases

- **Persistent failure** → stale cached price is kept (server cache / local listing unchanged); caller gets `null`/unchanged listing, same as today.
- **Breaker state loss** (app restart, server restart) → breaker resets to open; worst case one extra probe per distributor, no data loss.
- **Rate limiting preserved** — every attempt (plain, retry, browser) still honors `rateLimitMs`; cooldown means fewer total hits, never more.
- **Concurrency** — server `refreshSingleFlight` already dedupes in-flight requests; the breaker is checked inside `refreshPrice`, so concurrent calls share the same breaker state.
- **Browser unavailability** → graceful degradation to plain HTTP; breaker still records the outcome.

## 6. Testing

Vitest coverage in `tests/` (mirroring `scraping-integration.test.ts`):

- Retry on transient error, backoff timing.
- Blocked → browser escalation (mocked browser) → success.
- Blocked → browser also blocked → cooldown set, `"skipped"` on next call.
- Consecutive transient failures → cooldown after threshold.
- Cooldown expiry → re-probe → success resets breaker.
- HTTP-status-based blocked detection (403/429).
- Client breaker store persists via AsyncStorage adapter; server store via in-memory.
- Integration: `refreshPrice`/`refreshListing` return stale/null on `"skipped"`.

## 7. Out of Scope

- New parsers or new distributor sites (parser coverage is a separate effort).
- Changing the 1h price-cache TTL.
- Desktop (Tauri) app wiring.
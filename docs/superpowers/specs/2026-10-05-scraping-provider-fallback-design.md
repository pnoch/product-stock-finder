# Managed Scraping-Provider Fallback (server-only) — Design Spec

**Date:** 2026-10-05
**Goal:** When the browser path is blocked by Cloudflare, let the server fall back to a managed scraping API that solves the challenge and returns rendered HTML — vendor-neutral, env-configured, spend-capped, and inert when unconfigured.

## Problem

The hardest distributors (Winncom, B&H Photo, GoWiFi) block even Patchright + system Chrome. The 2026 anti-detect research showed these need either a nodriver-class control plane (Python, AGPL) or a managed scraping API with residential IPs. The app already prefers the server when configured, so a server-side provider fallback is the natural place to add that capability.

## Scope

**In scope:** a vendor-neutral server-side provider fetcher, registered via env, tried only after a browser/plain block, capped by the existing spend budget.

**Out of scope:** mobile (no provider fetcher registered → method unavailable); a specific vendor SDK (the provider is a URL template); residential-proxy hosting; a Python control plane.

## Architecture

### 1. Injection hook — `lib/scrapers/resilient.ts`

Add a module-level hook so `lib/` stays server-agnostic:

```ts
export type ProviderFetcher = (url: string) => Promise<string | null>;
let providerFetcher: ProviderFetcher | null = null;
export function setProviderFetcher(fn: ProviderFetcher | null): void { providerFetcher = fn; }
export function getProviderFetcher(): ProviderFetcher | null { return providerFetcher; }
```

The mobile app never calls `setProviderFetcher`, so the provider method is a no-op there.

### 2. Provider method — tried only after a block

In `runResilientFetch`, after the `methods` loop, if the final outcome is `blocked` and a provider fetcher is registered, attempt it once:

```ts
if (blockedOutcome && getProviderFetcher()) {
  const outcome = await attemptProvider(opts, maxRetries, retryBaseMs);
  if (outcome.status === "ok") {
    await recordSuccess(opts.state, opts.parser.id, now());
    return outcome;
  }
  lastOutcome = outcome;
}
```

`attemptProvider` calls the fetcher, classifies the returned HTML with `classifyFetchStatus`, and returns `{ html, status: "ok", method: "provider" }` on success. `FetchOutcome.method` gains `"provider"`.

### 3. Server provider fetcher — `server/scrapers/provider.ts` (new)

Vendor-neutral, configured entirely by env:

- `SCRAPING_PROVIDER_URL` — a template containing `{url}` (e.g. `https://api.zenrows.com/v1/?apikey=KEY&url={url}&js_render=true`). Unset → no fetcher.
- `SCRAPING_PROVIDER_API_KEY` — optional; sent as `Authorization: Bearer <key>` unless `SCRAPING_PROVIDER_KEY_HEADER` overrides the header name.
- `registerScrapingProvider()` — builds the fetcher and calls `setProviderFetcher(...)`; returns whether it registered. The fetcher:
  1. `if (!tryConsumeBudget("scraping.provider")) return null;`
  2. `const target = template.replace("{url}", encodeURIComponent(url));`
  3. `fetch(target, { headers })` → return the body text (or null on non-2xx).

### 4. Spend budget — `server/spend-budget.ts`

Add `"scraping.provider": { limit: envLimit("scraping.provider", 100), windowMs: 60*60*1000 }` so a runaway loop can't drain the provider account. The fetcher degrades to `null` when the budget is spent.

### 5. Wiring

`server/_core/index.ts` (server boot) calls `registerScrapingProvider()` once. Because `lib/scrapers/resilient.ts` is shared, the registration is process-global for the server only.

## Data Flow

1. `prices.get` → `fetchAndParse` → `resilientFetch` → plain/browser both blocked.
2. `runResilientFetch` sees `blocked` + a registered provider → `attemptProvider` → provider returns rendered HTML → `classifyFetchStatus` ok → parsed → price returned.
3. No provider configured → identical to today.

## Error Handling

- Provider unset → method unavailable (no behavior change).
- Budget spent / provider non-2xx / fetch error → `null` → the block stands (breaker records it).
- The provider is tried at most once per fetch and only on a block, bounding cost.

## Security & Privacy

- The API key lives only in server env; never sent to clients.
- The provider receives the same public distributor URL the server would fetch itself.
- No new client data flows.

## Testing

- `tests/server-scraping-provider.test.ts` — with a mocked `fetch`: URL template interpolation, key header, non-2xx → null, budget exhaustion → null, unset env → `registerScrapingProvider()` returns false and leaves no fetcher.
- `tests/scrapers/provider-fallback.test.ts` — register a fake fetcher: it is tried only after a block (not on success), and not when unregistered; `method: "provider"` on success.
- `tests/scrapers/provider-guard.test.ts` — source guard: only `server/scrapers/provider.ts` reads `SCRAPING_PROVIDER_*`.

## Risks & Mitigations

- **Per-request cost** → block-only trigger + the `scraping.provider` budget + graceful `null`.
- **Vendor lock-in** → a URL template, not an SDK; any provider that accepts a URL and returns HTML works.
- **Hardest sites still fail** → the provider is the best available server-side lever; if it also fails, the block stands and the user-facing session assist remains the fallback.

## Success Criteria

- With `SCRAPING_PROVIDER_URL` set, a Cloudflare-blocked distributor returns a price via the provider; with it unset, behavior is unchanged.
- The provider is called only after a block and only within budget.
- `pnpm verify` stays green; no mobile/web bundle change.

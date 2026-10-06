# Monetization Foundation (Entitlements + Telemetry + Paywall) — Design Spec

**Date:** 2026-10-06
**Status:** Draft for review

## Goal

Build the provider-agnostic foundation for charging: an entitlement seam, a
free/Pro feature split, a telemetry seam, and a paywall UI — all fully testable
today, with the real RevenueCat/Sentry SDKs plugging in later with no call-site
changes.

## Problem

The app has no billing, no entitlement concept, and no telemetry. Signing is
already done (`scripts/android-keystore.sh`, `credentials/`, the Gradle config,
`plugins/with-android-release-signing.js`). The gap is the monetization layer.

The real SDKs (RevenueCat + Play Billing, Sentry/PostHog) need external accounts
and product IDs that cannot be created or verified here. So the deliverable is
the **abstraction layer** those SDKs plug into — mirroring the scraping-provider
seam (Phase 1105).

## Scope

**In scope:** `lib/entitlements.ts` (provider seam + `useEntitlements`),
`lib/telemetry.ts` (sink seam + `track`), the free/Pro gating, and a paywall UI.

**Out of scope (needs accounts):** the RevenueCat SDK + Play Billing wiring +
product IDs; the Sentry/PostHog SDK wiring; live purchase verification. These
are follow-on once the accounts exist.

## Architecture

### 1. Entitlements — `lib/entitlements.ts` (new)

A provider seam, exactly like `setProviderFetcher` in `lib/scrapers/resilient.ts`:

```ts
export type EntitlementTier = "free" | "pro";
export interface EntitlementState {
  tier: EntitlementTier;
  isPro: boolean;
  /** ISO date when the subscription expires, if known. */
  expiresAt?: string;
}
export interface EntitlementProvider {
  getState(): Promise<EntitlementState>;
  /** Optional: start a purchase flow; resolves to the new state. */
  purchase?(planId: string): Promise<EntitlementState>;
  /** Optional: restore prior purchases. */
  restore?(): Promise<EntitlementState>;
}
let provider: EntitlementProvider | null = null;
export function setEntitlementProvider(p: EntitlementProvider | null): void;
export function getEntitlementProvider(): EntitlementProvider | null;
export const FREE_STATE: EntitlementState; // { tier: "free", isPro: false }
export async function getEntitlementState(): Promise<EntitlementState>;
```

Default (no provider) → `FREE_STATE`. RevenueCat registers a provider later.

A React hook `hooks/use-entitlements.ts` wraps it with React Query (or local
state) so screens can read `{ isPro }` reactively.

### 2. Feature gating — `lib/pro-features.ts` (new)

A single source of truth for the split, so the boundary is testable:

```ts
export const FREE_WATCHLIST_LIMIT = 5;
export type ProFeature =
  | "unlimited_watchlist"
  | "background_monitoring"
  | "digests"
  | "server_sync"
  | "bulk_import"
  | "landed_cost_sourcing";
export function isProFeature(feature: ProFeature): boolean;
export function canAddToWatchlist(currentCount: number, isPro: boolean): boolean;
```

**The split (confirmed):**
- **Free** — watch up to 5 products, manual refresh, standalone (device) scraping.
- **Pro** — unlimited watchlist, background monitoring + alerts + digests,
  server-backed coverage, sync, bulk import, landed-cost sourcing.

Enforcement points (each reads `useEntitlements()`):
- **Watchlist add** — block the 6th add for free users with an upgrade prompt. The
  gate lives in a single helper `guardWatchlistAdd(currentCount, isPro)` called
  from the add sites (`app/search.tsx`, `app/w/[token].tsx`); the undo path in
  `app/(tabs)/watchlist.tsx` is NOT gated (restoring a just-removed item must
  always work).
- **Background Refresh toggle** (Settings) — Pro-only; disabled + "Pro" badge for free.
- **Bulk import** — Pro-only.
- **Sync** — free users run local-only (already the default when signed out); Pro enables server sync.
- **Digests** — Pro-only.

### 3. Telemetry — `lib/telemetry.ts` (new)

A sink seam with a no-op default:

```ts
export interface TelemetrySink {
  track(event: string, props?: Record<string, unknown>): void;
}
let sink: TelemetrySink | null = null;
export function setTelemetrySink(s: TelemetrySink | null): void;
export function track(event: string, props?: Record<string, unknown>): void; // no-op when unset
```

Emit the key events now (no-op until a sink is registered): `app_open`,
`product_added`, `alert_set`, `restock_watch_set`, `scrape_failed`,
`paywall_shown`, `upgrade_started`. A guard test asserts no PII/secrets are
passed (no email, no API keys).

### 4. Paywall UI — `components/paywall/`

- `components/paywall/paywall-screen.tsx` — a "Go Pro" screen listing the Pro
  benefits, with a plan selector and a CTA. When no provider (or no `purchase`),
  the CTA shows "Pro is coming soon" and is disabled — honest, not broken.
- A Settings "Upgrade to Pro" row (with `crown.fill` icon) that opens it.
- The watchlist-limit prompt and the Pro-only toggles route here.

## Data Flow

1. App boot: `setEntitlementProvider(...)` (no-op today) and `setTelemetrySink(...)` (no-op today).
2. `useEntitlements()` reads the state; screens gate on `isPro`.
3. Free user hits the 6th watchlist add → paywall prompt → `track("paywall_shown")`.
4. `purchase()` (when a provider exists) → new state → UI unlocks.

## Error Handling

- No provider → `FREE_STATE`; the paywall shows "coming soon" (never a dead button).
- A provider throwing → fall back to `FREE_STATE` (fail closed, never grant Pro on error).
- Telemetry `track` never throws (wrapped); a broken sink can't crash the app.

## Testing

- `tests/entitlements.test.ts` — default is free; a registered provider's state is returned; a throwing provider falls back to free; `setEntitlementProvider(null)` resets.
- `tests/pro-features.test.ts` — `canAddToWatchlist` boundary (5 free, 6th blocked; unlimited when Pro); `isProFeature` for each feature.
- `tests/telemetry.test.ts` — no-op when unset; a registered sink receives events; `track` never throws when the sink throws; a source guard that no call site passes email/keys.
- `tests/paywall-guard.test.ts` — source guard that the paywall CTA is disabled without a provider.
- Existing tests stay green.

## Success Criteria

- With no provider, the app behaves exactly as today (everything free) — no regression.
- The gating boundary is enforced and unit-tested.
- The paywall renders and is honest ("coming soon") without a provider.
- `pnpm verify` stays green.

## Risks

- **Over-gating** → the free tier must stay genuinely useful (5 products, manual
  refresh, standalone). The split is a product decision; keep it generous.
- **Locking in a wrong assumption** → the provider seam means the real SDK is a
  drop-in; nothing about RevenueCat is baked into call sites.
- **Telemetry PII** → a guard test forbids email/keys in event props.

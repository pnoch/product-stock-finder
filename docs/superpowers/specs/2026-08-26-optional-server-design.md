# Optional Server / Android Standalone

Make the companion server fully optional: an Android build with no
`EXPO_PUBLIC_API_BASE_URL` must be a complete product — watchlist, alerts,
reminders, local notifications, and **live prices via on-device scraping** — while
a configured server keeps today's behavior (sync, push, cached prices, images,
insights) plus a new per-listing device-scrape fallback.

Today the gaps are: foreground price queries call only `fetchServerPrice`
(`lib/live-prices.ts:73`) with no local fallback; `fetchWithParser`'s dynamic
`import("./browser")` would pull Playwright into a native bundle (default Metro
config, no platform override); and startup fires five server calls that can only
fail when unconfigured.

## Decisions

- **Full local parity.** Without a server: everything except sync, push, product
  images, and LLM insights works; live prices come from on-device scraping.
- **Hybrid fallback.** Server configured: server first, per-listing device scrape
  on miss (cold cache, blocked, outage). Unconfigured: pure device.
- **Hide sign-in when absent.** No API base URL → Settings shows a local-only note
  instead of sign-in/sync/push sections.

## Server-availability gate

`isServerConfigured()` in `constants/oauth.ts`, next to `getApiBaseUrl()`:
returns `getApiBaseUrl() !== ""`. Web dev derives the API host from the sandbox
hostname; static web deploys and native builds without env return `""`.

## Price resolution — new `lib/price-source.ts`

```ts
export interface ResolvedPrice extends ServerPriceResult {
  source: "server" | "device";
}

export async function resolvePrice(
  distributorId: string,
  modelNumber: string,
): Promise<ResolvedPrice | null>
```

- If configured: `fetchServerPrice` (existing 4s race). Hit → `{...result,
  source: "server"}`.
- On miss or unconfigured: `scrapePriceOnDevice(distributorId, modelNumber)` —
  registry parser → `resilientFetch` with a module-level breaker store →
  `parsePrice(html, modelNumber)` → `{ snapshot: {...result, fetchedAt},
  history: [], source: "device" }` or `null`.

Consumers:

- `deriveListingQueries` (`lib/live-prices.ts`) queryFn switches to
  `resolvePrice`; `applyServerPrice` consumes `.snapshot` unchanged.
- `discoverListings` default `fetchPrice` becomes `resolvePrice`.
- `checkPriceDropsNow` uses `resolvePrice`.
- `refreshListing` keeps its own flow entirely — it needs raw fetch status
  (`blocked` vs `error`) for health classification and already implements the
  hybrid pattern manually.

Device scraping inherits parser rate limits, blocked detection, and breakers.

## Metro native stubbing

A pure helper in `scripts/metro-resolver.js`
(`resolveBrowserModulePath(platform, request, fallback)`) returns the stub path
for `ios`/`android` when the request targets `lib/scrapers/browser.ts`, else
defers to the default resolver. `metro.config.js` wires it into
`config.resolver.resolveRequest`. The stub already mirrors the export surface,
so `fetchWithParser`'s dynamic import stays playwright-free on native (its catch
falls back to plain HTTP).

## Startup gating

In `app/_layout.tsx`, when `!isServerConfigured()`: skip `registerPushToken`,
`syncServerNotifications`, `cleanupStaleDevices`, `loadFxRates` /
`maybeRefreshFxRates`, and `setupSync` registration. Static FX fallback rates in
`lib/currency.ts` remain the source for conversion.

## UI

- New `hooks/use-server-config.ts` returning `configured: boolean`.
- Settings (`app/(tabs)/settings.tsx`): unconfigured renders a single
  "Local-only mode — prices are fetched directly from distributors on this
  device" note in place of the sign-in card and sync/push sections. Configured
  renders unchanged.
- Connection badge: unconfigured shows a neutral "Local" state instead of an
  offline error.
- `lib/server-images.ts` / `lib/server-insights.ts` return `null` immediately
  when unconfigured (skips their timeout windows).

## Edge cases

- Configured-but-down server: fast fail → device scrape covers outages.
- iOS receives identical behavior; unconfigured static web takes the same
  local-only path (Playwright already stubbed there).
- Discovery across all 25 parsers on-device respects concurrency (3) and rate
  limits; it remains user-triggered only.

## Testing

- `tests/price-source.test.ts`: server hit; miss → device scrape; unconfigured
  skips the server leg entirely; device parse failure → null. Mock
  `fetchServerPrice`, `resilientFetch`, and the registry.
- Pure helper `resolveBrowserModulePath(platform, request, fallback)` in
  `scripts/metro-resolver.js`, unit-tested for the redirect and pass-through.
- Settings gating tests: unconfigured hides sign-in/sync sections and shows the
  local-only note.
- Update suites that mock `fetchServerPrice` for the new consumer signatures.

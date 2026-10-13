# Connected marketplaces implementation plan

> Execute tasks in order. Each task ends with behavioral verification. Use
> subagents only when the user selects delegated execution. Do not commit,
> publish, or release without the user's instruction.

**Goal:** Provide a visible marketplace connection browser, evidence-based
verification, scoped disconnect, shared Facebook search preferences, and search
recovery after reconnect.

**Architecture:** A device-local connection service owns verification and stale
result invalidation. A shared visible browser supports both existing distributor
assist and marketplace connections. Structured native page snapshots provide
the final URL, result cards, and observed search scope without changing existing
HTML fetch callers.

**Stack:** TypeScript, Expo Router, React Native WebView, AsyncStorage, native
cookie manager, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-13-connected-marketplaces-design.md`.

## Current interfaces and defects

- `WebViewHost.load()` returns HTML only. It cannot report the final URL or
  provide a visible login. Add an optional structured snapshot method and keep
  `load()` compatible with distributor callers.
- `SessionAssistModal` receives a `DistributorParser` but uses only its base
  URL. Replace that coupling with a URL prop and migrate both callers in
  `app/health.tsx` and `components/settings/site-sessions-section.tsx`.
- `clearDistributorSession()` swallows clearing failures. Connected Marketplace
  disconnect needs a result that reports unsuccessful clearing.
- `FacebookResultsSection` hardcodes Bangkok and 64 km. `FacebookSearchSheet`
  separately stores preferences and incorrectly describes the hidden renderer
  as a visible browser.
- `extractFbSearchResults()` scans neighbouring characters and may associate
  metadata with the wrong card. Missing cards currently become a false empty
  result.

## File responsibilities

| Path | Responsibility |
| --- | --- |
| `lib/marketplace/connections.ts` | Sites, verification states, local persistence, operation invalidation |
| `lib/marketplace/session-clear.ts` | Site-specific cookie and origin-storage clearing |
| `hooks/use-marketplace-connections.ts` | React subscription to connection metadata and preferences |
| `components/session-assist-modal.tsx` | General visible browser using a URL, optional navigation policy, and Done callback |
| `lib/scrapers/webview-host.ts` | Additive snapshot contract and extraction script |
| `components/webview-fetch-host.tsx` | Snapshot request support in the hidden renderer |
| `app/connected-marketplaces.tsx` | Connection cards, verification actions, Facebook scope controls |
| `app/you.tsx` | Route entry |
| `components/product/marketplace-card.tsx` | Reconnect entry carrying the tracked product |
| `lib/marketplace/fb-search.ts` | Card-scoped extraction, page classification, observed scope |
| `components/search/facebook-results-section.tsx` | Connection action, shared preferences, retry and scope labels |
| `components/marketplace/facebook-search-sheet.tsx` | Visible search browser and shared preferences |
| `lib/storage/index.ts` | Include new device-local keys in existing clear-all-data path |

## Task 1: Define local state and operation ownership

**Create:** `lib/marketplace/connections.ts`,
`tests/marketplace-connections.test.ts`.

- [ ] Define the following domain contracts. Use runtime schemas when reading
  stored JSON, and derive types from those schemas where practical.

```typescript
export type MarketplaceSite = "facebook" | "shopee" | "lazada";
export type ProbeCapability =
  | { kind: "search"; query: string }
  | { kind: "listing"; productId: string }
  | { kind: "navigation" };
export type Verification =
  | { kind: "not_checked" }
  | { kind: "checking" }
  | { kind: "ready"; checkedAt: string; capability: ProbeCapability }
  | { kind: "login_required"; checkedAt: string }
  | { kind: "unverified"; checkedAt: string; reason: string }
  | { kind: "unavailable" };
export interface FacebookSearchPreference {
  requestedArea: string;
  requestedRadiusKm: 10 | 30 | 64;
}
export interface ObservedSearchScope {
  area: string | null;
  radiusKm: number | null;
}
```

- [ ] Use AsyncStorage keys `marketplace_connections_v1` and
  `facebook_search_preferences_v1`. They must never enter sync or server
  notification payloads. Invalid stored JSON resets to not-checked status and
  an empty requested area with a 64 km radius.
- [ ] Define site URLs and exact HTTPS allowed host sets. Start Facebook at
  `https://www.facebook.com/marketplace/`, Shopee at `https://shopee.co.th/`,
  and Lazada at `https://www.lazada.co.th/`. Include observed Facebook
  `web.facebook.com` and mobile Facebook navigation. Any additional auth host
  requires a documented observed need. Reject credentials and custom ports.
- [ ] Serialize metadata writes so concurrent site checks cannot lose records.
  Use a monotonically increasing generation per site. Increment it when a new
  verification starts or disconnect begins. Older completions cannot persist
  state or notify subscribers.
- [ ] Provide subscriptions for hooks. Emit preference-change and verification
  events after successful writes. Keep secrets and full page HTML out of events.
- [ ] Add tests for invalid persistence, independent site updates, subscription
  cleanup, and late verification completion after disconnect. Example contract:

```typescript
it("does not restore readiness after disconnect", async () => {
  const oldGeneration = service.beginVerification("facebook");
  await service.invalidate("facebook");
  await service.complete("facebook", oldGeneration, {
    kind: "ready",
    checkedAt: "2026-10-13T00:00:00.000Z",
    capability: { kind: "search", query: "mac pro" },
  });
  expect(service.current("facebook")).toEqual({ kind: "not_checked" });
});
```

- [ ] Run `pnpm exec vitest run tests/marketplace-connections.test.ts` and
  `pnpm check`. No ready state may be inferred merely from a user tapping Done.

## Task 2: Generalize the visible session browser

**Modify:** `components/session-assist-modal.tsx`, `app/health.tsx`,
`components/settings/site-sessions-section.tsx`.
**Create:** `tests/marketplace-browser-policy.test.ts`.

- [ ] Replace the parser prop with a URL prop. Retain the current title,
  visible, Close, and Done behavior. Pass `assistUrl(parser)` from the existing
  distributor callers; do not introduce a second modal implementation.
- [ ] Add an optional site navigation policy and an origin label. Preserve
  existing distributor navigation behavior when no policy is supplied.

```typescript
interface Props {
  visible: boolean;
  url: string;
  title: string;
  onClose: () => void;
  onDone: () => void;
  allowNavigation?: (url: string) => boolean;
}
```

- [ ] The marketplace policy accepts only configured HTTPS hosts and an internal
  `about:blank` document where required. Reject unknown destinations in the
  WebView and offer an explicit external-browser action. Do not automatically
  open external URLs during redirects.
- [ ] Reset loading and displayed origin when the browser opens. Use safe-area
  insets. Keep non-incognito cookies and DOM storage configuration shared with
  the hidden pool. Unsupported platforms show an external-browser option and
  explain that external login does not establish a native app session.
- [ ] Test lookalike hosts, HTTP, ports, credentials, valid marketplace hosts,
  and distributor behavior with no marketplace policy.
- [ ] Run existing session-assist and browser-host tests found through
  `functions.glob`, then `pnpm check` and `pnpm lint`.

## Task 3: Capture verifiable snapshots and classify page access

**Modify:** `lib/scrapers/webview-host.ts`,
`components/webview-fetch-host.tsx`, `lib/marketplace/fb-search.ts`.
**Create:** `tests/marketplace-snapshot.test.ts`.
**Extend:** `tests/fb-search.test.ts`.

- [ ] Add optional `snapshot()` support to `WebViewHost`; existing fake hosts
  and HTML fetch callers continue to work. Do not replace `load()`.

```typescript
export interface MarketplacePageSnapshot {
  url: string;
  html: string;
  cards: Array<{
    itemUrl: string;
    title: string | null;
    priceText: string | null;
    location: string | null;
  }>;
  scope: { area: string | null; radiusKm: number | null };
  emptyMessage: string | null;
  loginVisible: boolean;
}
```

- [ ] Emit a bounded JSON message for snapshot requests containing final URL,
  page HTML, and observed structured values. Validate the message at the native
  boundary. Keep snapshot and clear-storage sentinel handling separate.
- [ ] In the page, associate each item link with its smallest result-card
  container. Reject ambiguous containers containing multiple distinct item IDs.
  Missing price, location, or title remains null. Accept THB only where a
  currency marker is observed. Never scan a character window for another card's
  price. Cap accepted observations at 20 and deduplicate by item ID.
- [ ] Keep final URL and visible effective location distinct from requested
  query parameters. Missing location becomes unconfirmed. Do not infer Bangkok
  or a radius from the request URL.
- [ ] Classify login using a visible login form or blocking dialog, including
  supported Thai text. A header Login link alone is insufficient. Return empty
  only when a recognizable search-results page explicitly reports no listings.
  All other zero-card pages become unverified or unreadable.
- [ ] Navigation-only probes cannot produce ready-to-check status. Facebook
  search probes require recognized result cards or a verified empty search page.
  Listing probes require matching identity and the provider's own readable price.
  Shopee and Lazada probes reuse their extractors for a tracked listing.
- [ ] Replace synthetic near-window fixtures with adversarial adjacent cards,
  a login dialog, a page with a header Login link, a genuine empty page, and
  an unrecognized page. Test mismatched final hosts and observed locations.
- [ ] Run `pnpm exec vitest run tests/marketplace-snapshot.test.ts tests/fb-search.test.ts`
  followed by `pnpm check` and `pnpm lint`.

## Task 4: Implement scoped disconnect and connection hooks

**Create:** `lib/marketplace/session-clear.ts`,
`hooks/use-marketplace-connections.ts`,
`tests/marketplace-session-clear.test.ts`.
**Modify:** `lib/storage/index.ts`.

- [ ] Wrap the native cookie manager at a testable boundary. Enumerate cookies
  for configured site hosts and expire their actual domain/path combinations.
  Clear origin storage through the WebView host. Do not use `clearAll()` as a
  site-specific fallback.
- [ ] Invalidate the site's generation before clearing. Distinguish complete
  clearing, partial clearing, and unavailable native modules. Partial failure
  produces unverified state with a user-facing explanation.
- [ ] Prevent a site verification from running during disconnect. Wait for old
  site operations to finish or terminate their WebView requests before the
  final clearing pass so a late page cannot restore cookies unnoticed. Report
  timeout rather than claim successful disconnection.
- [ ] Add the new local keys to the existing clear-all-data operation. Keep
  account sign-out distinct from marketplace disconnect.
- [ ] The hook subscribes to local metadata changes and exposes state,
  preference updates, verification, and disconnect. Unsubscribe on unmount.
  No hook subscribes to or transmits cookie values.
- [ ] Test domain isolation, cookie-path clearing, origin clear failure, delayed
  probes, clear-all-data integration, and no calls to unrelated site origins.
- [ ] Run targeted tests and `pnpm check`.

## Task 5: Add the connection screen and recovery actions

**Create:** `app/connected-marketplaces.tsx`.
**Modify:** `app/you.tsx`, `components/product/marketplace-card.tsx`,
`components/search/facebook-results-section.tsx`,
`components/marketplace/facebook-search-sheet.tsx`.
**Create:** `tests/connected-marketplaces-screen.test.tsx`.

- [ ] Render three themed connection cards with status and last verification
  time. Show verified capability in the ready label. Disable conflicting
  operations while checking or disconnecting.
- [ ] Connect opens the visible session modal. Close only cancels. Done closes
  the modal and begins the appropriate probe. A missing probe context shows
  couldn't-verify guidance to open a tracked listing or enter a search query.
- [ ] Carry probe context through validated route parameters. Product links
  pass product ID. Search links pass the current keyword; URLs themselves come
  from provider builders, not arbitrary user-provided browser destinations.
- [ ] Add the route to You's typed row list. Add a Connect or Reconnect action
  to marketplace cards and Facebook search's login message.
- [ ] Replace the search sheet's hidden `host.load()` browser claim with the
  visible browser. Explain that actual location/radius is chosen in Facebook.
  Show requested and observed scope with an explicit unconfirmed state.
- [ ] Both search entry points use the shared requested preferences. Remove
  `FB_LOCATION` and `FB_RADIUS_KM` hardcoding from the inline section.
- [ ] Retry the retained query once on a new successful Facebook search
  verification event. Failed checks and manual screen refresh must not trigger
  repeated searches. A query change supersedes the older request.
- [ ] Test Connect opens the browser, cancel leaves status unchanged, Done
  starts verification, failure offers Retry, and reconnect retries the current
  query exactly once. Test a late old query result cannot replace a newer one.
- [ ] Run screen tests, `pnpm check`, and `pnpm lint`. Verify the `/you` and
  `/connected-marketplaces` routes in a running app.

## Task 6: Verify the full flow and record native evidence

- [ ] Run the targeted connection, snapshot, disconnect, and search tests.
- [ ] Run `pnpm check`, `pnpm lint`, and `pnpm verify`. Use
  `CARGO_NET_OFFLINE=true` only if the local Rust dependencies are already
  cached and registry access stalls.
- [ ] Drive web UI to confirm native-unavailable guidance, route navigation,
  and external-browser actions. Do not interpret this as Android login proof.
- [ ] On a real Android device, connect Facebook in the visible browser, then
  retry the retained query in the hidden renderer. Record observed location,
  radius, result extraction, and any login challenge.
- [ ] Test cancellation, app restart, session expiry, and Disconnect. Verify
  disconnection requires signing in again while unrelated site sessions remain.
- [ ] Repeat the page-access check for Shopee or Lazada with a tracked listing.
  Record listing-readiness separately from site navigation and background checks.
- [ ] Add an evidence document under `docs/superpowers/` naming tested flows,
  commands, and outcomes. Do not record credentials, cookies, or private page HTML.
- [ ] Add the next phase entry to `todo.md` only for verified completed work.
  Keep the real-device step pending if no signed-in Android device is available.

## Plan review

All approved requirements have tasks: visible browser in Task 2, verification
states in Tasks 1 and 3, scoped disconnect in Task 4, shared location and retry in
Task 5, and native proof in Task 6. Existing HTML callers retain their interface.
No new distributor parser, backend endpoint, sync collection, or billing service
is required. Server-side share-link resolution and price extraction are outside
this plan and retain their existing limits.

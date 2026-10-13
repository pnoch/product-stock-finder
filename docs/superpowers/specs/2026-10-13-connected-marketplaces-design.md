# Connected marketplaces design

**Date:** 2026-10-13
**Status:** Design approved. Implementation pending.

## Goal

Give users a visible marketplace login browser and a reliable way to check,
recover, and disconnect on-device sessions. Facebook search must use a shared
location preference and report when the effective search area is unconfirmed.

## Existing behavior

`components/webview-fetch-host.tsx` renders hidden WebViews. Calling
`getWebViewHost().load()` cannot provide a visible login or browsing experience.
`components/session-assist-modal.tsx` already provides a visible WebView that
shares native cookies and DOM storage with the hidden renderer.

`lib/scrapers/session-assist.ts` clears distributor sessions, but catches failures
without returning a clearing result. Marketplace disconnect must report failures
rather than claim the user has signed out when clearing fails.

Facebook's inline search currently uses Bangkok and a 64 km radius. A real
anonymous browser test redirected the search to San Francisco. Requested URL
parameters do not establish the effective location.

## Screen and entry points

Add `/connected-marketplaces` with Facebook Marketplace, Shopee Thailand, and
Lazada Thailand cards. Link it from `app/you.tsx`, marketplace product cards,
and Facebook search's sign-in message.

Each card shows verification status, last verification time, and these actions:

- Connect or reconnect opens a visible browser on the marketplace's own site.
- Check again repeats the page-access probe without a new login.
- Disconnect clears this marketplace's session and reports the result.

Closing the browser cancels verification. Tapping Done starts verification.
Neither action marks the marketplace ready by itself.

## Session browser

Reuse the existing visible WebView configuration without requiring a
`DistributorParser`. Separate the site description from the parser interface,
and migrate existing distributor callers in the same change.

Allow only the HTTPS marketplace and authentication destinations required by
each supported site. Unknown destinations require an external-browser action.
Show the current origin so users can identify the site receiving their login.

Keep native cookies and DOM storage on-device. Never upload or sync credentials,
cookies, browser HTML, or session tokens. Do not add server Facebook accounts.

Web and desktop entry points explain when native connection checks are unavailable.
An external-browser login does not imply the app's session is connected.

## Verification states

Persist only non-secret, device-local verification metadata. Do not store this
metadata in the account-synced settings collection.

| State | Evidence |
| --- | --- |
| Not checked | No completed verification exists. |
| Checking | A probe is in progress. |
| Ready to check | A supported page rendered and exposed the data needed for the checked capability. |
| Sign-in required | A known login wall appeared. |
| Couldn't verify | A network error, unexpected page, challenge, or unreadable result prevented verification. |
| Unavailable on this platform | The native shared-session browser is unavailable. |

Record the capability verified, such as Facebook search or a specific tracked
listing. Reading the site's home page does not prove price extraction works.
Ready status does not establish background monitoring, authentication on all
pages, or access to every listing. Label stored readiness with its timestamp.

Probe with a tracked product or the user's current search where available.
Use neutral, capability-limited results when no such page exists. Expired or
blocked sessions update the relevant status without changing saved prices.

## Disconnect

Clear cookies for the marketplace's configured domains and browser storage for
its configured origins. Cancel pending checks and invalidate verification metadata.
Suppress results from checks that finish after disconnect.

Never clear unrelated distributors or all browser cookies as a per-marketplace
fallback. If site-specific clearing cannot complete, display that failure and
leave the verification status uncertain. Test disconnect against the native
cookie manager because cookie domain and origin storage behave differently.

## Facebook search location

Store a device-local requested area and radius shared by the search sheet and
inline results. Remove hardcoded Bangkok preferences from the inline component.
Offer a visible Facebook browser action to choose the actual location and radius.

Distinguish requested settings from the location and radius observed on the
result page. If the page does not expose its effective scope, show
"Location not confirmed". If it reports a different area, show that area and
offer a correction action. Do not label those results as matches within the
requested radius.

Do not request device location permission in this release. A future explicit
"Use my location" action can introduce that permission.

## Search recovery

Facebook's sign-in message includes Connect Facebook. Retain the current query
through the connection flow. After successful capability verification, retry
that query once. Changes to the query cancel or supersede older results.

Use separate outcomes for sign-in required, unreadable results, network failure,
and a verified empty result set. Missing item cards alone cannot prove no matches.

Associate every result's title, price, and location with its own card or structured
listing object. Replace nearby-character-window extraction where it can attach
metadata from a different listing. Preserve missing fields as unknown.

## Acceptance checks

- Connect opens a visible browser. Existing distributor session-assist callers
  continue to work with the shared browser component.
- Done starts verification. Cancel and a login page never produce ready status.
- Readiness records the verified capability and timestamp without storing secrets.
- Disconnect affects only the selected marketplace, reports failures, and prevents
  stale in-flight results from restoring readiness.
- Facebook's inline results and search sheet use the same requested location.
- A page showing San Francisco cannot be labelled Bangkok. Missing observed
  location displays "Location not confirmed".
- Reconnect retains the query and triggers one retry after verified access.
- Failed extraction is distinct from verified no matches. Adjacent cards cannot
  exchange their titles, prices, or locations.
- Run `pnpm check`, `pnpm lint`, and relevant behavioral tests. Verify native
  login, shared-session access, expiry recovery, and disconnect on Android.

## Release evidence

Automated tests establish state transitions, extraction boundaries, and UI
actions. A signed-in Android test establishes whether Facebook or Shopee
actually permits access in this app. Report those results separately.

## Deferred work

Saved searches, scheduled Facebook checks, new marketplaces, server-side sessions,
and device-location permissions are outside this feature.

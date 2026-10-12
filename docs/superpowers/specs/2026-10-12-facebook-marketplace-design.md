# Facebook Marketplace Tracking — Design Spec

**Date:** 2026-10-12
**Status:** Design approved; implementation pending

## Goal

Find Facebook Marketplace listings from the user's Discover search and track
individual listings using the existing watchlist,
manual price history, acquired state, and marketplace confirmation UI. Provide
user-triggered on-device checking when an authenticated page exposes a verifiable
listing price.

## Evidence

The supplied share link `https://www.facebook.com/share/1DRTMqB7bR/`
returned an HTTP 400 error page through plain HTTP. A headed Patchright browser
resolved it to `https://web.facebook.com/marketplace/item/2556068711502321/`.
The title identified a Mac Pro 2019 listing in Bangkok; the visible page
required login and exposed no price.

Authenticated extraction and Android WebView login have not been verified.
Successful browser navigation does not establish successful price monitoring.

## Identity and Region

Extend the marketplace identity union with `platform: "facebook"`, `itemId`,
and `canonicalUrl`. Use `fbmp-{itemId}` as the stable listing key. Facebook item
URLs do not encode a market; do not infer Thailand solely from the URL.

The confirmation form explicitly selects Thailand and THB for the initial
release. Store this market choice as listing metadata, separate from identity.
There is no variant or SKU field for Facebook listings. Seller and title are
confirmed by the user; require a positive THB price for manual tracking.

## Import

- Accept HTTPS canonical `/marketplace/item/{digits}/` URLs on exact supported
  Facebook hosts and `/share/{token}/` links. Reject credentials, nonstandard
  ports, lookalike domains, and unsupported routes.
- Canonical URLs resolve without fetching. Strip tracking parameters.
- Share-link resolution may use the existing browser infrastructure with
  bounded time, concurrency, and resource usage. Validate the initial URL,
  browser navigation destinations, and final item URL; preserve existing
  private-address protections. Browser access must not weaken the HTTP
  resolver's SSRF boundary.
- Never treat a general Facebook share as a Marketplace item without observing
  a canonical item destination. If resolution fails, ask the user to copy the
  individual Marketplace item link.
- Prefill only observed title/identity. Do not send failed Facebook extraction
  to an LLM to invent product information. Do not fetch seller-profile data.

## Discover Search

Facebook Marketplace becomes an explicit search source in Discover. Users enter
a product keyword and choose a search location and radius. Shipping country is
not a substitute for location: Facebook listings are typically local offers.
Do not request precise device location unless the user selects “Use my location.”

Start with a Facebook-specific results section rather than automatically merging
unverified Facebook listings into the distributor catalog. Show each observed
listing's title, item link, image, displayed price/currency, and location when
available. Missing fields remain unknown; do not infer stock or condition.

Search uses the user's on-device Facebook session. First verify that authenticated
search pages render usable result cards and honor the chosen location/radius.
If extraction is unavailable, open the search interactively in the WebView so
the user can browse and select an item link for import. Distinguish “sign in
required,” “couldn't read results,” and a verified empty result set.

Selecting “Track” opens the listing confirmation flow. Never add a listing merely
because its title resembles the search keyword. Product equivalence, condition,
and seller are confirmed by the user. Deduplicate by Facebook item ID.

The app must not claim full-market coverage, complete pagination, or exact-match
availability from a partial rendered result page. Search results are session-
and location-dependent and must not enter the global price cache.

## On-device Checking and Sessions

Provide an explicit “Open Facebook listing” action and a user-triggered
“Check price” action. Reuse the session-assist UI where feasible, with a
Facebook-specific session entry independent of distributor-parser registration.

Login happens on Facebook's page in the device WebView. Credentials and session
cookies remain on-device; do not upload them to the backend or sync them.
Offer a disconnect action that clears this site's session using the existing
session clearing infrastructure.

Before saving an observation, verify the final item ID, supported currency,
and listing title against the confirmed listing. Changed title, missing price,
price range, login wall, deleted listing, or unknown availability must produce
an explicit result and preserve the last-known price. A title change requires
user reconfirmation rather than silently changing the tracked item.

Extraction must target the item's own price, excluding recommendations,
shipping, instalments, and related listings. Availability remains unknown
unless the page explicitly reports available, sold, or unavailable.

Manual updates retain their manual provenance. A browser observation uses
separate observation provenance; a successful single check does not switch
the product into background automatic monitoring.

## Existing Features

Watchlist, manual history, notes, acquired toggles, and external visits remain
available. Exclude Facebook listings from distributor discovery, automatic
alerts/restocks, server history uploads, and global price-drop aggregation
until a separately verified background monitoring path exists. Date reminders
may remain available because they do not depend on automatic price extraction.

No general distributor or Rust parser is added in this release. Desktop and web
must preserve synced metadata and show honest manual/session-required status,
without promising a native Android WebView capability they do not possess.

## Acceptance Checks

- Search retains the user's keyword/location/radius and does not silently search
  a different area. Confirm this through a signed-in device test.
- Search result extraction ignores non-listing links, deduplicates item IDs,
  preserves missing metadata, and reports login/error/empty states distinctly.
- Selecting a result carries its identity into confirmation without inventing
  product equivalence or price metadata.
- URL recognition distinguishes item/share/unsupported routes and rejects
  unsafe hosts, schemes, ports, credentials, invalid IDs, and excessive input.
- Share resolution accepts only observed Marketplace destinations, terminates
  on loops/timeouts, and rejects private-address or unapproved navigation.
- Builder validation rejects invalid prices and mismatched identity; metadata
  and price history survive storage, sync, and backup.
- Extraction rejects mismatched items, ambiguous prices, changed titles,
  recommendation prices, login walls, and unsupported currencies.
- Failed checks leave price/history unchanged. Successful checks append only a
  verified observation and do not automatically enable background alerts.
- Test the supplied listing on a signed-in Android device before claiming live
  extraction works; automated fixtures alone cannot prove Facebook access.

## Deferred

Authenticated search and background checking require separate feasibility
gate: real-device extraction, session persistence, expiry recovery, and Android
background execution must all be demonstrated first. Other countries, cross-
listing product matching, seller messaging, purchase automation, and server-side
Facebook accounts are outside this release.

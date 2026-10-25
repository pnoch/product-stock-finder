# OmniShop native rebuild — architecture and first vertical slice

Date: 2026-10-25

Status: approved by the user; foundation implementation is tracked in
`../plans/2026-10-25-omnishop-native-foundation.md` and `native/README.md`.

## Decisions confirmed with the user

- Rebuild with Kotlin Multiplatform and Compose Multiplatform.
- Build under `native/` in this repository.
- Start with a clean local database. Legacy AsyncStorage, cloud accounts,
  desktop JSON files, and old backup formats require no migration support.
- Android, iOS, Windows, and macOS must each work independently.
- No OmniShop account, hosted user database, or desktop dependency is allowed.
- English and Thai are the initial languages; THB is the initial display currency.

The existing TypeScript application is a reference for behavior, fixtures, and
regression cases. Its cloud services and scraper escalation are not dependencies
of the new application. Existing release automation continues to describe that
application until native builds have their own verified release pipeline.

## Scope and delivery order

The master brief describes several independently substantial systems. Deliver
them as vertical slices rather than scaffold every feature at once:

1. Independent local shopping and purchase tracking: import a link, save and
   compare offers, create an order, attach shipments, view events offline.
2. A verified real carrier adapter and encrypted portable backup complete the
   first release gate. Neither can be represented as complete by a placeholder.
3. Authorized shopping APIs, federated search, richer product identity, saved
   searches, and local price monitoring.
4. Receipt/email imports, safe reconciliation, returns, refunds, and warranties.
5. Encrypted peer pairing and record-level synchronization.
6. Optional AI, image search, browser companion, and additional integrations.

The initial engineering slice is smaller than the complete Phase 1 release in
the master brief. A working Android screen alone does not constitute Phase 1.

## Alternatives considered

### Chosen: shared Kotlin core, shared Compose UI, native platform services

Share domain rules, SQLDelight queries, connector contracts, repositories, and
screen state. Use platform implementations for key storage, file access,
sharing, link opening, notifications, and background scheduling. This provides
one business model without pretending the operating systems expose identical
capabilities.

### Alternative: shared Kotlin core with separate native UIs

SwiftUI on iOS and native desktop UIs offer closer platform integration but
require multiple independent screen implementations. This is not the selected
starting point; native platform views remain available where needed.

### Alternative: retain the existing Expo/Tauri implementation

This has lower migration cost and remains a useful reference, but the user
explicitly selected a clean Kotlin/Compose rebuild.

## Module ownership

Create modules only when their first behavior is implemented:

```text
native/
  core/          Kotlin domain values, policies, connector/carrier contracts
  data/          SQLDelight schema, repositories, transactions, secure payloads
  connectors/    Delegated search, link imports, authorized provider adapters
  app/           Shared Compose screens and presentation state
  androidApp/    Android entry point and platform services
  desktopApp/    Windows/macOS entry point and platform services
  iosApp/        Xcode host and iOS platform services
```

Dependency direction is `app -> core`, `data -> core`, `connectors -> core`.
Platform entry points construct dependencies and supply them to the app. The
domain does not import Compose, SQLDelight, Android, or a provider SDK.

Repositories return domain records and observable query results, not database
rows. Use constructor injection; a dependency-injection framework is not needed
for the first slice. UI actions call use cases; composables do not perform SQL,
provider authentication, or network requests.

Version pins must come from a verified compatible Kotlin/Compose/Gradle/AGP/
SQLDelight/Ktor matrix before scaffolding. Commit a Gradle wrapper, version
catalog, dependency verification metadata, and documented toolchain requirements.

## First-slice experience

Use the requested navigation: Discover, Search, Saved, Orders, Profile.

- Discover initially offers honest source entry points and locally recent items;
  it does not show fabricated trends or recommendations.
- Search offers source selection, delegated search, pasted-link import, and
  manual entry. Unsupported native search is explicitly labeled.
- Saved displays user-added products, selected listings, notes, and comparison.
- Orders is the primary post-purchase dashboard, including shipment timelines.
- Profile holds language/currency preferences, local data, backup, and connector
  configuration. There is no required sign-in screen.

New installations are empty. A user can import a link without metadata, edit the
result, save it, create an order, and record shipment events without connectivity.
Changing language preserves data and supports Thai text layout and input.

## Domain invariants

### Products and offers

`Product` represents a canonical item; `ProductVariant` identifies capacity,
generation, color, region, and other relevant options. `Listing` is a particular
seller/source offer with its own condition, URL, availability, and provenance.

Use stable locally generated IDs. Source IDs are separately namespaced by
connector. A URL or title is not a canonical product ID. Initial matching is
explicit user selection or a strong exact identifier; fuzzy similarity proposes
a match but never silently merges variants or used/new offers.

### Money and comparison

Use integer minor-unit amounts with explicit currency and scale, not binary
floating-point money. Exchange rates have source, base/quote currencies,
observation time, and a stale indicator. Preserve paid amounts in their original
currency permanently.

Shipping, duties, fees, and discounts are individually known or unknown.
Unknown shipping is not zero. A comparison shows verified subtotal and any
estimated components separately; it cannot claim the cheapest delivered offer
when material costs are unknown. Historical lows are labeled as lowest observed
over the local observation period.

### Orders and shipments

Keep order/payment state separate from shipment state. One order has many
items and shipments. A shipment can carry quantities from multiple order items;
delivered quantities must not exceed the assigned quantities. Replacement and
return shipments retain a relationship to their original order.

Store original carrier status/text alongside the normalized state from the
master brief. Events retain source time, UTC instant when resolvable, original
timezone/offset, import time, source ID, and manual/provider provenance. Unknown
timezones remain explicitly unresolved rather than being guessed as UTC.

Order progress is derived from item allocations and shipment progress. One
delivered package cannot mark a split order fully delivered. Manual corrections
remain distinguishable from carrier observations.

### Imports and reconciliation

Import into a proposed record before confirming ambiguous data. Exact source +
order ID and source + event ID are idempotency keys. Carrier + tracking number
is evidence for reconciliation, not proof that two orders are identical.
Ambiguous duplicate candidates require user confirmation. Re-importing does not
erase notes, attachments, or unrelated local records.

## Persistence and security

SQLDelight with SQLite is the primary local store. Transactions protect an order
with its items/shipments and other multi-record changes. Use indexed queries,
pagination, and bounded image caches; do not load every order into screen state.
FTS support must be checked on every bundled platform driver before enabling it.

Initial schema: product, variant, source, seller, listing, price observation,
saved product, order, order item, shipment, shipment item, tracking event,
attachment, import provenance, notification receipt, and preferences. Extend
with migrations when later features arrive; do not create empty subsystems for
every future entity.

Credentials and data-encryption keys belong in platform secure storage. Sensitive
fields such as delivery addresses and private attachments must be encrypted
using an audited authenticated-encryption implementation. Bind encrypted payloads
to their record identity, use fresh nonces, and define key-loss behavior before
writing sensitive fields. Do not silently fall back to plaintext when secure
storage is unavailable. Driver/crypto support is an implementation gate, not a
reason to label an unencrypted SQLite database as encrypted.

Android uses Keystore-backed protection; iOS uses Keychain. macOS Keychain and
Windows credential protection require tested desktop adapters. Each unsupported
development platform must clearly expose unavailable secure operations.

No shopping data, analytics, or crash payload is sent to an OmniShop server.
Direct carrier/merchant calls send only information needed for that request.
Logs redact credentials, addresses, receipt content, and tracking identifiers.

New-format backups export a consistent record snapshot and encrypted attachments
into a versioned authenticated container. Use a vetted password KDF and crypto
library; do not invent a cipher or password scheme. Wrong passwords, tampering,
and truncated input must fail without partially replacing the database.

## Connector and carrier boundaries

Model capability per operation, including Supported, Requires Authorization,
Requires Developer Approval, Link Import Only, External Search Only,
Unsupported, and Temporarily Unavailable. Authorization readiness and transient
health are distinct: a network outage does not change a provider's API grant.

Search delegation opens a validated source URL and never returns synthetic
native listings. Link import can succeed as a bookmark with no accessible
metadata. Extract public metadata only where access is permitted; do not inherit
CAPTCHA or anti-bot bypass behavior from the old scraper implementation.

Ktor adapters own pagination, rate limits, bounded retries, caching, cancellation,
and normalized errors. Requests must validate URLs and redirects, reject private
or local destinations where appropriate, and avoid forwarding credentials across
origins. HTML is data, never executable application content.

Facebook starts with external search and user-assisted/manual import. Shopee
starts with link import/delegation unless approved access is configured. eBay
Browse and similar APIs are enabled only with a supported credential flow.
Confidential client secrets cannot be bundled in the mobile app; when a provider
requires them, direct integration remains unavailable unless the user supplies a
supported user-controlled service. There is no hidden OmniShop token broker.

The first live carrier candidate is Thailand Post. Verify its current official
documentation, credentials, device-client suitability, and terms before committing
to an adapter. Retain the manual tracking path if access is not available; never
fake events to satisfy the acceptance gate.

## Background work and notification guarantees

Android uses WorkManager, iOS BackgroundTasks, and desktop a cancellable scheduler.
The domain accepts a clock and scheduling interface; it does not promise exact
poll intervals. Foreground refresh remains available on every platform.

Persist event/notification deduplication keys and last-successful-check times.
Notify only for real newly observed changes. Local notifications are best effort
under OS restrictions, not an instant remote-push promise.

## Peer sync boundary for the later milestone

Design stable IDs and repository write boundaries now, but do not route the first
slice through a nonexistent sync transport. Add record-level operation queues,
QR identity pairing, encryption, revocation, replay protection, attachment
transfer, and explicit conflict policies as one separately reviewed design.
No copying live database files, mandatory desktop hub, cloud identity, or
centrally hosted shopping history is permitted.

## Acceptance and proof

The first engineering slice must demonstrate on Android and desktop:

1. Launch without an account/backend; select English or Thai and use THB.
2. Save a manual/pasted-link item with unavailable metadata honestly labeled.
3. Compare two explicitly matching offers with unknown shipping preserved.
4. Create an order and split quantities into two shipments.
5. Record events and mark one shipment delivered; the parent order remains
   partially delivered.
6. Restart offline and retain saved items, orders, and timeline events.
7. Re-import the same source event without duplicating it.
8. Cancel a search/refresh without leaving a misleading success state.

The complete first release additionally requires the same independent slice on
iOS, Windows, and macOS, one real carrier integration, sensitive-data protection,
and encrypted backup/restore. A Linux development build does not prove Windows
or macOS packaging; Linux cannot validate or sign an iOS build.

Tests cover money arithmetic, unknown fees, variant boundaries, split delivery,
event idempotency, import ambiguity, SQL migrations, offline repositories,
connector capability rendering, and key/backup failure behavior. Platform tests
cover actual secure storage, file sharing, notifications, and lifecycle limits.

## Implementation sequence after approval

1. Verify dependency compatibility and available native toolchains; establish
   reproducible builds and CI without disturbing the existing app pipeline.
2. Implement domain values and the first SQLDelight schema with migration tests.
3. Implement repositories and manual/link-only connector behavior.
4. Implement Saved/product comparison and Orders/split-shipment screens.
5. Connect platform services and prove Android/desktop offline restart behavior.
6. Complete iOS/Windows/macOS build validation, real carrier access, and encrypted
   backup/security gates before calling the first release complete.

## Open implementation gates

- The first live carrier requires verified current API access and suitable
  credentials. Manual tracking does not satisfy the live-carrier release gate.
- Compatible native dependency versions and secure storage/crypto libraries must
  be verified against current maintained releases before locking them.
- macOS/iOS and Windows runners or development hosts are needed for native
  platform proof. Record unavailable checks explicitly rather than claiming them.

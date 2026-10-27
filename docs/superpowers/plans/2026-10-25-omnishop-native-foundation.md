# OmniShop Native Foundation Implementation Plan

> **For agentic workers:** Use the executing-plans skill to implement this plan inline, one verifiable task at a time. No subagents are required.

**Goal:** Establish a buildable Kotlin Multiplatform foundation with correct money, shipment, connector, and SQLite behavior, then connect a first local Compose workflow.

**Architecture:** Independent Gradle build under `native/`. Pure Kotlin rules live in `core`, SQLDelight storage in `data`, and shared Compose UI in `app`. Platform entry points supply database drivers; no legacy server, account, or data migration is involved.

**Tech Stack:** JDK 21, Gradle 9.5.0, Kotlin 2.4.21, Compose Multiplatform 1.12.2, SQLDelight 2.4.1, AGP 9.3.1, compile SDK 37. Android AAR metadata requires SDK 37; AGP 9.3.1 requires Gradle 9.5.0. Keep library/plugin versions in `native/gradle/libs.versions.toml`.

---

## Scope

This is the foundation sub-project of the approved architecture, not the complete
Phase 1 release. Real carrier access, encrypted sensitive fields/backups, iOS
hosting, native share extensions, background notifications, and peer sync have
separate follow-on milestones. Do not expose UI for unimplemented sensitive-data
storage or invent carrier events.

## File ownership

- `native/settings.gradle.kts`: repositories and module inclusion.
- `native/build.gradle.kts`: shared plugin declarations.
- `native/gradle/libs.versions.toml`: exact compatible dependency versions.
- `native/gradlew`, `gradlew.bat`, `gradle/wrapper/*`: reproducible wrapper.
- `native/core/src/commonMain/kotlin/com/omnishop/core/`: domain values/policies.
- `native/core/src/commonTest/kotlin/com/omnishop/core/`: portable behavior tests.
- `native/data/src/commonMain/sqldelight/com/omnishop/data/`: normalized SQLite
  schema and indexed queries.
- `native/data/src/commonMain/kotlin/com/omnishop/data/`: repository transaction
  boundaries and domain mapping.
- `native/data/src/jvmTest/kotlin/com/omnishop/data/`: actual SQLite persistence
  and rollback tests, not mocked query tests.
- `native/app/`: shared Compose local workflow, introduced after persistence works.
- `native/desktopApp/`: JVM launcher and file-backed SQLite driver.
- `native/androidApp/`: Android entry point and SQLite driver after the common
  contracts compile.
- `native/README.md`: exact build commands and implemented/planned matrix.

## Task 1: Reproducible independent Gradle build

- [x] Create the version catalog, settings, root build and `core` module. Use
  `mavenCentral()`, `google()`, and `gradlePluginPortal()` only; no private mirror
  or developer machine paths in committed configuration.
- [x] Generate a Gradle 9.5.0 wrapper using the installed Gradle distribution.
  Include its official distribution SHA-256.
- [x] Give `core` a JVM target and iOS arm64/simulator-arm64 targets. Native Apple
  compile tasks are validated on macOS, not claimed as verified on Linux.
- [x] Run `./gradlew :core:jvmTest` from `native/`; prove the compiler/test runner
  resolves before building more modules.

## Task 2: Money and offer comparison contracts

- [x] Add `Currency(code, scale)` and `Money(minorUnits, currency)` with exact
  integer addition/subtraction and explicit overflow rejection. Require matching
  currency for arithmetic; unknown fees are distinct from zero.
- [x] Start with behavior tests:

```kotlin
assertEquals(30L, (Money(10, Currency.THB) + Money(20, Currency.THB)).minorUnits)
assertFailsWith<IllegalArgumentException> {
    Money(10, Currency.THB) + Money(10, Currency.USD)
}
assertFailsWith<IllegalArgumentException> {
    Money(Long.MAX_VALUE, Currency.THB) + Money(1, Currency.THB)
}
```

- [x] Model a known/unknown shipping cost explicitly. A known zero means free
  shipping; unknown does not participate in a delivered-price winner claim.
- [x] Run `./gradlew :core:jvmTest`; add mixed currencies, zero shipping, unknown
  shipping, invalid scales, and numeric boundary cases before calling this done.

## Task 3: Order quantities and shipment progress

- [x] Add order items, shipment allocations, normalized shipment states, and
  manual/provider provenance. Use identifiers supplied by the application so
  tests do not depend on random values or the system clock.
- [x] Prove that an order for two items with only one delivered unit is partially
  delivered, not delivered. Reject negative/zero quantities, allocations above
  ordered quantities, and allocations referencing another order's items.
- [x] Define event idempotency using source + source-event ID within a shipment.
  Preserve raw provider descriptions and occurrence/import timestamps.
- [x] Run `./gradlew :core:jvmTest`; assert duplicate events cannot increase
  delivered quantity or overwrite a user's manually recorded note.

## Task 4: Honest connector capabilities

- [x] Define shopping-operation capabilities (`search`, `importUrl`)
  separately from authorization readiness and temporary health.
- [x] Initial source descriptors offer manual/link import and external search;
  they must not claim that Facebook/Shopee have a live native search adapter.
- [x] Exercise the contract directly:

```kotlin
assertEquals(Capability.EXTERNAL_SEARCH_ONLY, facebook.search)
assertEquals(Capability.LINK_IMPORT_ONLY, facebook.importUrl)
```

- [x] Reject credentials, non-HTTPS provider links, and unsupported URL schemes
  at the platform/network boundary. No network request is required to save an
  explicitly manual product.

## Task 5: SQLDelight persistence

- [x] Add the `data` module with SQLDelight runtime and an actual JDBC SQLite
  driver for tests. Store products, saved listings, orders, order items,
  shipments, item allocations and tracking events in separate tables.
- [x] Add foreign keys, quantity constraints, bounded/paginated list queries,
  and unique source-event identity. Do not add plaintext address/credential
  columns as a substitute for the later security milestone.
- [x] Implement transaction-backed create-order and attach-shipment operations.
  Inject the SQL driver instead of opening it inside the domain.
- [x] Verify with a file-backed database: save data, close driver, reopen file,
  assert records and events survive. Attempt an invalid multi-row write and
  assert the whole transaction rolls back.
- [x] Run `./gradlew :data:jvmTest :core:jvmTest`.

## Task 6: First Compose local workflow

- [x] Introduce shared UI only after the real repositories pass their tests.
  Start empty; allow adding a saved item, creating a manual order, attaching a
  tracking number and recording a labeled manual event.
- [x] Provide the five requested navigation destinations; only implemented
  actions are enabled. UI calls repository/use-case methods, not SQL directly.
- [x] Build a desktop launcher with an OS-user-data SQLite path. Native package
  checks must run on the matching OS; a Linux compile is a development check.
- [x] Add Android targets and its entry point using the documented AGP/Kotlin
  integration. Validate the actual build before documenting Android support.
- [x] Keep English/Thai labels in centralized resources; manual price entry is THB.

## Task 7: Verification and handoff

- [x] Record pinned toolchain documentation and tested commands in
  `native/README.md`. Distinguish compiled, exercised, and planned platforms.
- [x] Generate dependency verification metadata after successful dependency
  resolution; do not suppress checksum failures with lenient verification.
- [x] Run the native tests and desktop/Android compile tasks actually available
  on this host. Record external access/toolchain failures as blockers.
- [x] Run `git diff --check`; do not commit or push without an explicit request.

## Follow-on plans

Create separate implementation plans for encrypted storage/backup, authorized
carrier access, iOS host and platform proof, returns/email reconciliation, and
peer synchronization. None of those features is marked implemented by this
foundation plan.

## Self-review

- The user explicitly chose clean installation: no compatibility/import tasks.
- Full Phase 1 acceptance is broader than this foundation; deferred gates are
  listed instead of hidden behind mock implementations.
- Money does not use `Double`; shipment progress derives from allocated
  quantities; connector status is truthful.
- Verification uses real compiler/SQLite execution and retains a separate
  platform-proof requirement for macOS/iOS/Windows.

## Execution record

- Native tests: 110 passed, zero failures/errors across core, connectors, carriers, data,
  and presentation. SQLite migration verification passed.
- Android debug APK built. The emulator smoke exercises saved offers, split
  delivery, force-stop/restart, Thai selection and a second restart.
- Linux desktop runtime packaged and actually launched under Xvfb with an
  isolated database. Its jlink configuration explicitly includes `java.sql`.
- Normal builds pass with generated dependency verification enabled.
- `pnpm check` and `pnpm lint` also passed for the existing application.
- The UI now creates orders with multiple line items and allocates quantities
  per item to split packages; the Android smoke and presenter tests cover
  partial delivery and over-allocation rejection.
- Manual returns/refunds now have an order-detail workflow, eight localized
  states, quantity reservation rules, return tracking, notes, and exact amounts.
  A received-refund state requires a positive amount. Updates preserve an
  existing currency; the UI does not submit claims or initiate payments.
- SQLDelight migration `1.sqm` adds returns to native database version 2. The
  version-1 snapshot is retained; a file-backed test and Android in-place APK
  upgrade preserved existing records. Encrypted backup payload schema 2 adds
  returns while accepting prior schema-1 native backups; the encryption
  envelope remains version 1.
- Android smoke covers a return and partial refund, English/Thai restart
  persistence, and the encrypted address. Multi-order backup regression tests
  cover return ownership, refund validation and atomic replacement.
- Encrypted backup v1 and its restore path are implemented and tested (wrong
  password, tampering, truncation, invalid snapshot, rollback). Android and
  desktop have platform file pickers; the pickers themselves are not automated.
- The shipping address is encrypted with a device data key stored in Android
  Keystore or the desktop OS credential store. Backups carry it only inside the
  password-encrypted snapshot and re-encrypt it with the restoring device key.
  Android E2E proves address save/read across a restart; Linux desktop startup
  does not exercise the keyring (no Secret Service under Xvfb).
- Desktop packaging now passes in CI on macOS, Windows, and Linux. These are
  unsigned app images; no interactive UI run or installer signing on macOS/
  Windows is claimed.
- The iOS XcodeGen host builds and launches in the simulator on macOS CI. The
  shared Compose UI renders, SQLite opens, CryptoKit backs encryption, Keychain
  stores the device key, and the document picker is wired. No device signing,
  App Store build, background tasks, share extension, or iOS UI automation
  beyond launch/screenshot is claimed.
- A Thailand Post adapter, secure API-key settings, carrier id persistence and
  order-screen refresh are implemented. MockHTTP tests cover auth, mapping,
  Buddhist-era timestamps, errors and network failure; the Android smoke covers
  the unconfigured-key gate. No live Thailand Post request is claimed. SPX, LEX,
  KEX, Flash, J&T and Ninja Van are link-only choices (SPX/LEX via a labeled
  17TRACK lookup); URL generation is unit-tested, not opened in the smoke. Other
  carrier APIs, token/rate-limit caching, location columns and return-carrier
  tracking remain follow-on work.
- Orders now carry optional per-item prices and order-level financials with one
  currency, merchant order ID, purchase date and payment label; item subtotal and
  recorded total are separate. CSV import has a preview, duplicate skipping,
  strict row validation and all-or-nothing insertion. Schema 4 (migration 3.sqm)
  and backup schema 4 cover the fields; tests cover parsing, duplicates,
  transaction rollback, migration and encrypted round-trip.
- Receipt attachments use the existing encrypted private-field/device-key path
  (8 MB cap), are included in encrypted backups, and support list/save-copy/
  delete. PDF parsing, OCR, email import and payment-ledger reconciliation
  remain follow-on work. Deadline reminders, signing, peer transport/pairing and
  order sync also remain.
- Review hardening: receipt listing parses metadata without Base64-decoding
  content, receipt names/MIME types are sanitized, CSV input is capped at 10 MB /
  50,000 rows with field-length limits, financials show a computed-total mismatch
  warning, and CSV preview shares the presenter mutex.
- Sync record engine added: `sync_meta` (schema 5/`4.sqm`), transactional
  settings/watchlist/order hooks, watchlist and order aggregate payloads,
  LWW/tombstones/cursors, malformed-payload rejection, private-field preservation
  and migration tests. A JVM loopback TLS proof covers mutual auth, pinning and
  framed exchange; a manual encrypted sync package exports/merges settings,
  watchlist and orders with LWW. Desktop and Android now share a real TLS
  transport with manual pairing, peer store, Devices UI and revocation. iOS
  transport, QR/mDNS/SAS, Android runtime pairing proof, attachments and
  background sync are still missing.
- Android smoke still covers the existing purchase/delivery/return flow; receipt
  file-picker interaction is unit-tested only.
- A release-signed native APK (existing keystore, CN=Product Stock Finder,
  package `.nativepreview`, version 1/0.1.0) was installed after removing the
  debug build and passed the same emulator smoke. A Linux `.deb` (unsigned,
  installer 1.0.0) was also produced. iOS and Windows/macOS signing,
  notarization and store upload remain blocked on external credentials.
- Work is on `native/omnishop-foundation`. The returns/refunds increment is
  verified locally; consult the native Actions workflows for remote
  iOS/Windows/macOS validation of the current revision.

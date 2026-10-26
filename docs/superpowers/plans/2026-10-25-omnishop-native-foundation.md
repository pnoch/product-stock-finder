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

- Native tests: 43 passed, zero failures/errors across core, connectors, data,
  and presentation. SQLite migration verification passed.
- Android debug APK built. The emulator smoke exercises saved offers, split
  delivery, force-stop/restart, Thai selection and a second restart.
- Linux desktop runtime packaged and actually launched under Xvfb with an
  isolated database. Its jlink configuration explicitly includes `java.sql`.
- Normal builds pass with generated dependency verification enabled.
- `pnpm check` and `pnpm lint` also passed for the existing application.
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
- No real carrier, iOS Keychain adapter, or iOS host is claimed. See
  `native/README.md` for follow-on gates.
- Work is on `native/omnishop-foundation`; no commit/push was requested.

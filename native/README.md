# OmniShop native foundation

Clean-slate Kotlin/Compose rebuild. This is a working development foundation,
not the complete Phase 1 release from the master product brief.

## Implemented

- Shared Kotlin rules for integer minor-unit money, currency boundaries,
  overflow checks, and acquisition costs with explicitly unknown components.
- Canonical saved products with separate manually entered offers and initial
  price observations. Comparable offers are explicitly attached by the user;
  no fuzzy matching or automatic metadata extraction is claimed.
- Local manual purchase records with multiple line items, optional per-item
  prices, order currency, shipping, tax, discount, recorded total, merchant
  order ID, purchase date and payment-method label (never card data). The UI
  shows item subtotal, computed total and recorded total separately, and warns
  when the recorded total differs from subtotal + shipping + tax − discount, so
  an unreconciled total is visible rather than silently “corrected”. Per-item package allocations,
  tracking numbers/carrier labels, manual event timelines, and derived partial
  delivery are included. Over-allocation is rejected by the domain and database.
- Peer-sync record engine for **settings, watchlist, order aggregates and
  encrypted receipt attachments** (orders include items + shipments +
  allocations + events + returns): `sync_meta`, aggregate payloads, LWW with
  device-id tie-break, tombstones and cursors, all transactional. Remote order
  updates preserve local private address fields; receipt bytes are transferred
  through the private-field payload, never plaintext. Profile also offers a
  **manual encrypted sync package** that exports current records and LWW-merges
  them on another device (settings, watchlist, orders and receipts). A JVM
  loopback TLS proof covers mutually authenticated self-signed certificates,
  pinning, framed exchange and receipt transfer. **Desktop (JVM) and Android**
  have a real TLS peer transport: EC P-256 identity, manual one-time pairing
  code, certificate pinning, peer store, Devices UI and revocation. iOS now has a
  Swift TLS transport for both client and host roles (pairing and sync in both
  directions), Bonjour discovery/advertisement (verified on macOS in separate
  processes), and `BGTaskScheduler` background sync registration. An iOS simulator
  XCTest target exists but is not yet stable in CI. The Android transport is
  loopback-tested on JVM and compiled for Android; an Android↔desktop pairing
  attempt on a dedicated AVD was blocked by adb/emulator hangs and remains
  unproven.
- CSV order import with a review-before-import dialog. Required columns are
  `merchant`, `order_id`, `currency`, `item_title` and `quantity`; optional
  columns cover dates, scale, item prices and order totals. Conflicting
  order-level values are rejected, duplicates are reported and skipped by
  merchant order ID, and a failed multi-order insert rolls back the batch.
  Input is capped at 10 MB / 50,000 data rows, with length limits on merchant,
  order ID and item title.
- SQLDelight/SQLite transactions, foreign keys, indexes, bounded list queries,
  empty version-1/2/3/4/5 schema snapshots, and migration verification.
- A BYOK Thailand Post connector through TrackingMore. The user supplies a
  TrackingMore API key, stored only in the platform SecretStore; the app calls
  TrackingMore with `courier_code=thailand-post` and maps the returned events.
  Events preserve the raw carrier description/timestamp, use provider
  provenance, and are deduplicated. A package records its selected carrier id.
  Mock-HTTP tests cover successful mapping, pending/unauthorized/bad-request
  responses and network failures. Live event mapping was verified with
  `JD282523205TH`: 10 events, delivered. **No live event mapping has been
  verified without a real API key.**
- Link-only choices for **SPX Express, LEX (Lazada), KEX/Kerry, Flash Express,
  J&T Express and Ninja Van**. KEX/Flash/J&T/Ninja Van open the carrier's own
  tracking page with the number; SPX and LEX open a clearly labeled 17TRACK
  lookup because they have no stable public deep link. These store the carrier
  id but make no API request and are never presented as live tracking.
- Manual per-item return records with reasons, return tracking numbers, notes,
  all eight refund/return states, and exact minor-unit refund amounts. Received
  refund states require a positive amount; rejected requests release their
  reserved units. Return records are included in encrypted backups.
- Encrypted receipt/document attachments per order. Choose a file (up to 8 MB),
  keep a user-supplied name, save a copy, or delete it. Receipts are stored as
  authenticated private fields under the order, so they use the same device key,
  ciphertext and encrypted-backup path as the shipping address. Listing parses
  metadata headers without Base64-decoding the content; names/MIME types are
  sanitized. No PDF parsing, OCR, or email import is performed.
- Password-protected encrypted backup/restore (AES-256-GCM, PBKDF2-HMAC-SHA256
  with 600,000 iterations and a random salt). Restore validates every record and
  replaces the database in one transaction; wrong passwords, tampering and
  malformed files fail without changing local data. Desktop uses a native file
  dialog; Android uses the system document picker.
- Encrypted shipping address per order. The field key is AES-256-GCM encrypted
  with a random device data key stored in Android Keystore or the desktop OS
  credential store, bound to the order id and field name as AAD. Backups carry
  the address inside the password-encrypted file and re-encrypt it with the
  restoring device's key; plaintext addresses never enter the SQLite file or the
  backup file.
- Source declarations and external searches for Facebook Marketplace, Shopee,
  Lazada, and eBay. Product links save as bookmarks without a network request.
- English/Thai labels and persisted language selection. Manual price entry is
  THB; automatic currency conversion and additional currency selectors are not
  implemented in this preview.
- Shared Compose navigation: Discover, Search, Saved, Orders, Profile. Wide
  windows use a navigation rail. OmniShop icon assets are reused.
- Android debug APK and a packaged JVM desktop application on Linux for
  development. No account, backend, or desktop is needed by Android.

The UI always labels tracking as manual and sources as external-search/link-only.
Known zero shipping is distinct from unknown shipping. Taxes/payment fees remain
unknown in the entry UI; it does not claim a cheapest delivered-price winner.

## Not implemented yet

Other carrier adapters, live verification against Thailand Post with a real
account, marketplace account connections, email/PDF parsing and OCR (manual
receipt attachments are implemented), automatic metadata extraction, automatic
product matching, automated returns/refunds,
cart/checkout, local notifications/background scheduling, iOS peer transport,
iOS Bonjour discovery, iOS/desktop QR scanning, iOS background tasks/share
extensions, signing/notarization, and additional sensitive fields are subsequent
milestones.

The development SQLite database is not encrypted as a whole. The shipping
address and receipt contents are stored as authenticated ciphertext under the
device key; carrier API keys use the platform SecretStore. Encrypted portable
backups protect exported files, not the live database. The backup password is
never stored; losing it makes the file unreadable.

On Linux desktop, the OS credential store needs a running Secret Service
(gnome-keyring or KWallet). The app still starts without one, but address
operations and backups containing addresses fail with a clear error rather than
falling back to a plaintext key file. The full Phase 1 release remains
blocked on OS secure storage, one genuinely supported live carrier, and platform
validation.

The current UI loads the first 100 products/orders. Repositories support bounded
pagination; pagination controls, full-text search and large-dataset UI performance
proof are still required before the scale acceptance criteria can be claimed.

## Modules

| Module | Responsibility |
| --- | --- |
| `core` | Platform-independent values, cost rules, shipment progress, return policies, capabilities |
| `data` | SQLDelight queries, transactions, domain mapping, platform database drivers |
| `connectors` | Validated bookmark URLs and source-owned external search URL builders |
| `carriers` | Carrier contracts, Thailand Post auth/tracking, timestamp and status normalization |
| `app` | Shared Compose UI, bilingual labels and suspendable presentation actions |
| `androidApp` | Android launcher, external browser handoff, local SQLite composition |
| `desktopApp` | JVM window, OS data-directory selection and packaged runtime |

`core` has no Compose, database, networking or platform dependency. Database work
runs off the UI thread and presentation mutations are serialized. Tests use real
SQLite, including a file close/reopen, rollback, and late tracking-event import.

## Toolchain

| Tool | Pin |
| --- | --- |
| JDK | 21 |
| Gradle wrapper | 9.5.0, official distribution SHA-256 pinned |
| Kotlin / Compose compiler plugin | 2.4.21 |
| Compose Multiplatform | 1.12.2 |
| Compose Material 3 | 1.9.0 (the version resolved by this Compose plugin) |
| Android Gradle Plugin | 9.3.1, using the new Android KMP plugin |
| Android SDK | compile 37, target 36, minimum 26 |
| SQLDelight | 2.4.1 |
| Ktor client | 3.6.0 with CIO (JVM), OkHttp (Android) and Darwin (iOS) engines |

Library/plugin versions live in `gradle/libs.versions.toml`. Gradle dependency
verification checksums are in `gradle/verification-metadata.xml`; normal builds
use verification, not lenient mode. When adding a platform/dependency, resolve
and review its new checksums explicitly before updating the metadata. Generating
checksums is trust-on-first-use, not proof of publisher signatures.

Compatibility references checked during implementation:

- <https://www.jetbrains.com/help/kotlin-multiplatform-dev/compose-compatibility-and-versioning.html>
- <https://www.jetbrains.com/help/kotlin-multiplatform-dev/multiplatform-compatibility-guide.html>
- <https://github.com/sqldelight/sqldelight/releases/tag/2.4.1>

The Android AAR metadata requires SDK 37. AGP 9.3.1 requires Gradle 9.5.0;
Gradle 9.4.1/SDK 36 are insufficient for this combination. The Kotlin/Native
toolchain archive is pinned in the verification metadata; Apple targets link
only on macOS.

## Build and run

Run commands from `native/`, using `gradlew.bat` on Windows.

```bash
./gradlew :core:jvmTest :connectors:jvmTest :carriers:jvmTest :data:jvmTest :app:jvmTest
./gradlew :data:verifyCommonMainOmniShopDatabaseMigration
./gradlew :desktopApp:run
./gradlew :desktopApp:createDistributable
./gradlew :androidApp:assembleDebug
```

Android requires `ANDROID_HOME` or an uncommitted `local.properties` containing
`sdk.dir`. Install `platforms;android-37.0` and `build-tools;37.0.0` through
Android SDK Manager. No server environment variables or provider credentials are
needed to build or use the local flow.

iOS (requires macOS and Xcode):
`brew install xcodegen`, then `cd iosApp && xcodegen generate`, open
`iosApp/OmniShop.xcodeproj`, and run the `OmniShop` scheme. The generated
`.xcodeproj` is gitignored; `project.yml` and Swift sources are the inputs.

APK: `androidApp/build/outputs/apk/debug/androidApp-debug.apk`.
Preview application ID: `com.app.stocktrackerpro.nativepreview`. This separate
package installs alongside the old app and does not read or import its data.

## Release signing

The Android release build was signed and smoke-tested locally. The existing
release keystore is reused (`credentials/release.keystore`, configured by the
gitignored `credentials/keystore.properties`); do not commit either file. The
signing certificate DN is `CN=Product Stock Finder` even though the package is
the separate native preview.

```bash
./gradlew :androidApp:assembleRelease
apksigner sign --ks ../credentials/release.keystore   --ks-key-alias <alias> --ks-pass pass:<password>   --key-pass pass:<password>   --out /tmp/omnishop-native-0.1.0-signed.apk   androidApp/build/outputs/apk/release/androidApp-release-unsigned.apk
apksigner verify --print-certs /tmp/omnishop-native-0.1.0-signed.apk
```

The verified release artifact was installed after uninstalling the debug build
(different signing key) and passed the same emulator smoke via
`--apk <signed-apk>`. Release artifacts are generated/distributed outside git
and are not part of the source commit.

`./gradlew :desktopApp:packageDistributionForCurrentOS` produces a Linux `.deb`
(installer version 1.0.0) as an unsigned development build. CI still produces
unsigned Windows/macOS app images. No Windows/macOS code signing,
notarization, or App Store/Play upload is configured. iOS has no signing team,
export options, or device build.

Linux packaged executable:
`desktopApp/build/compose/binaries/main/app/OmniShop/bin/OmniShop`.

## Release verification

Latest verified artifacts (outside git):

| Artifact | SHA-256 |
| --- | --- |
| `omnishop-native-0.1.0-universal.apk` | `2bd8d944058b6d8b249abb821263ea8825f1303ae4ea9d7b20a3794953250c52` |
| `omnishop_1.0.0_amd64.deb` | `4025a1d107b159b9aa468560788d21630e5f1d4596d579511942ddb445a6fbcf` |

Share page: `http://172.23.194.22:8897/` (old 5.28.2 APK, native preview APK and
Linux `.deb`). Verify with `curl -fsS http://172.23.194.22:8897/SHA256SUMS`.

Release checklist:

```bash
./gradlew :core:jvmTest :connectors:jvmTest :carriers:jvmTest :data:jvmTest   :app:jvmTest :sync:jvmTest :data:verifyCommonMainOmniShopDatabaseMigration   :desktopApp:createDistributable :androidApp:assembleDebug
./gradlew :androidApp:assembleRelease :desktopApp:packageDeb
apksigner sign --ks ../credentials/release.keystore --ks-key-alias <alias>   --ks-pass pass:<password> --key-pass pass:<password>   --out /tmp/omnishop-native-0.1.0-signed.apk   androidApp/build/outputs/apk/release/androidApp-release-unsigned.apk
apksigner verify --print-certs /tmp/omnishop-native-0.1.0-signed.apk
adb install -r /tmp/omnishop-native-0.1.0-signed.apk
```

The Android release signature is `CN=Product Stock Finder`, certificate
SHA-256 `3d4b56423a21f076127dd5a29fd7116f8aa7f1ae2b59c0e05c9170c9ba549ecc`.
The `.deb` is an unsigned development build. iOS signing/TestFlight remains
paused until Apple Silicon or a signing team is available.

## Platform proof

| Platform | Current evidence |
| --- | --- |
| Android | Debug and release-signed APKs built. An instrumented test (`TlsSyncInstrumentedTest`) proves Android Keystore identity, TLS pairing, SAS and record sync against the desktop harness. A Compose UI test (`DevicesPairingUiTest`) proves the Devices pairing and sync flow, and an mDNS instrumented test (`MdnsPairingInstrumentedTest`) proves nearby discovery, pairing and sync on Android. Earlier UI attempts were confounded by duplicate `MainActivity` instances each creating a sync server; `MainActivity` is now `singleTask`, and `adb reverse` is verified working. The release build was exercised on `emulator-5590`: saved/compare/order/partial-delivery/encrypted-address/return/partial-refund/carrier-selection/restart/Thai, plus database upgrades. Signature `CN=Product Stock Finder`, package `.nativepreview`, versionCode 1 / versionName 0.1.0. Encrypted backup uses the system picker (unit-tested crypto/restore, picker not automated). Carrier refresh is exercised only through the unconfigured gate; adapter HTTP is MockEngine-tested, not live. Link-only URLs and receipts are unit-tested; receipt file picker is not automated |
| JVM on Linux | Tests, classes, packaged runtime, actual window startup under Xvfb; TLS peer sync server/client, pairing, peer store and revocation are implemented and loopback-tested. Address cryptography uses the OS keyring (lazy; no keyring daemon under Xvfb); backup uses a native file dialog |
| Windows/macOS | `:desktopApp:createDistributable` succeeds on GitHub macOS and Windows runners; app-image contents are uploaded as CI artifacts. No interactive UI run on those OSes yet, and the installers are unsigned development builds |
| iOS | Swift TLS transport implemented for client and host roles: Keychain P-256 identity, pairing-code decode/creation, SAS, pinned `NWConnection`, `NWListener`, peer persistence, bidirectional sync and Bonjour discovery/advertisement and `BGTaskScheduler` background sync. Client and host paired/synced on macOS; Bonjour advertisement/browse was verified with `dns-sd` and a separate process; the arm64 app builds. The Swift-only iOS simulator test suite runs in CI: 3 protocol fixture tests pass; the Keychain/TLS runtime test skips without a signing identity. The Intel host cannot run the arm64 Compose UI, and no device is attached. Background execution is not runtime-tested. XcodeGen host builds/launches on macOS CI; no device signing/App Store build, background tasks, share extension, or iOS UI automation beyond launch/screenshot |

`.github/workflows/native.yml` gates Android/JVM tests, the debug APK, the iOS
simulator framework link, and an iOS simulator build/launch with a rendered-frame
check.
`.github/workflows/native-desktop.yml` runs JVM tests and
`:desktopApp:createDistributable` on Ubuntu, macOS, and Windows, uploading each
app image. They validate committed/pushed changes; check the Actions results
for the current revision's remote status. These are development artifacts:
they are not code-signed, notarized, or release-ready installers.
The desktop installer version is `1.0.0` because macOS rejects a leading zero;
the application version remains `0.1.0`.

## Reproduce Android smoke evidence

Use an explicit emulator serial. `--reset` erases only the native preview's
database; omit it unless a clean smoke-test installation is intended. The full
scenario expects an empty English installation, so normally use a dedicated
emulator with `--reset`.

```bash
python3 scripts/smoke-android.py --serial emulator-5580 --reset
```

The script installs the APK, saves a product with two manually entered offers,
creates an order for two units, delivers one package, records a return and a
partial refund, force-stops/reopens the app, changes to Thai and repeats the
delivery/refund assertions. It captures screenshots under
`/tmp/opencode/omnishop-native-evidence/` and
stops the preview at the end. Backup/restore is covered by JVM tests, not by
this script (the Android document picker is a system UI).
It neither starts nor connects to the old API server.

For packaged Linux startup (requires Xvfb, xwininfo, Python Pillow with XCB):

```bash
./gradlew :desktopApp:createDistributable
xvfb-run -a -s "-screen 0 1280x900x24" python3 scripts/smoke-desktop.py
```

The desktop smoke uses an isolated temporary data directory and terminates only
the process it starts. It checks window startup and database creation, not a
complete desktop interaction scenario.

## Local data and migrations

- Android: application-private `omnishop.db`; OS backup is disabled for this preview.
- Windows: `%LOCALAPPDATA%/OmniShopNative/omnishop.db`.
- macOS: `~/Library/Application Support/OmniShopNative/omnishop.db`.
- Linux development: `$XDG_DATA_HOME/omnishop-native/omnishop.db`, falling back
  to `~/.local/share/omnishop-native/omnishop.db`.

`data/src/commonMain/sqldelight/databases/1.db` … `5.db` are empty generated
schema snapshots, with no test or user records. `1.sqm` adds `order_return`
(version 2); `2.sqm` adds `shipment.carrier_id` (version 3); `3.sqm` adds order
financial columns and `order_item.unit_price_minor` (version 4); `4.sqm` adds
`sync_meta` (version 5). None recreates or clears existing tables. File-backed
migration tests preserve version-1 products/orders, version-2 shipments,
version-3 orders and version-4 preferences; Android in-place APK upgrades
preserved existing records and the encrypted address before the clean smoke
scenario.

For future revisions, add SQLDelight numbered migrations and verify against the
prior snapshot. Never replace an existing database to make a test pass. No
compatibility with legacy Expo/Tauri data or backup formats is required.

## Returns and refunds

Use **Orders → select order → Manage returns & refunds**. Record an item,
quantity, and reason, then update its status, refund amount, return tracking
number, and notes. These actions are local bookkeeping: they do not contact a
merchant, submit a claim, or initiate a payment.

- States: Requested, Approved, Item returned, Processing, Partially refunded,
  Refunded, Rejected, Disputed (English/Thai).
- The domain and transactional repository reject references to another order's
  item, duplicate IDs, and cumulative active quantities above the purchased
  quantity. Rejected requests stop reserving units; reactivating them must
  still pass the cumulative check. Summation uses `Long` to prevent overflow.
- A partially/fully received refund requires a positive recorded amount. New
  entries use THB; editing an imported refund preserves its currency and scale.
- Amounts represent the current recorded total for that return, not a ledger
  of separate payments. The app does not yet reconcile refunds against an
  original paid total, calculate FX differences, or infer a full refund.
- Return deadlines/reminders, proof attachments, separate refund transactions,
  and merchant/carrier return integrations are not implemented yet.

## Carrier tracking (Thailand Post)

Profile → Carrier connections takes a **TrackingMore API key** (BYOK). It is
written to the platform SecretStore (Android Keystore, desktop OS credential
store, iOS Keychain) and is never stored in SQLite or included in backups.
Tracking requests go directly from the device to `api.trackingmore.com` with
`courier_code=thailand-post`; there is no OmniShop token broker or server, and no
built-in aggregator quota.

When adding a package, choose **Thailand Post API** to store the carrier id.
The shipment card then offers **Refresh tracking**. Without a saved key the UI
states that a key is required and sends no request. With a key, the adapter
creates/refreshes the TrackingMore shipment, maps events, and saves them with
`source=thailandpost` and provider provenance. Duplicate provider events are
ignored by the existing event key. Raw descriptions and timestamps are retained;
TrackingMore timestamps are left as original text because the API does not
guarantee an offset.

For carriers without an authorized API, choose the link-only chip. **SPX
Express** and **LEX (Lazada)** open a 17TRACK lookup; **KEX/Kerry**, **Flash**,
**J&T** and **Ninja Van** open their own tracking pages. These choices persist
the carrier id and tracking number but do not fetch or invent events. The
marketplace/seller may assign a different carrier than the store name suggests,
so the user must confirm the carrier rather than infer it from “Shopee” or
“Lazada”.

Current limits:

- Status normalization is a documented keyword heuristic, not an official
  carrier code table. Unknown descriptions stay `UNKNOWN`.
- The carrier's location is appended to the preserved description rather than
  stored in a dedicated location column.
- Each refresh creates the shipment once, then uses TrackingMore’s get endpoint
  for repeat refreshes (`4101 Tracking No. already exists`); live mapping for
  `JD282523205TH` returned 10 events. There is no
  rate-limit cache, retry queue, background polling, estimated-delivery fetch or
  multi-item tracking request. TrackingMore credits are the user's own.
- Only Thailand Post has a live BYOK adapter, via TrackingMore. SPX, LEX, KEX,
  Flash, J&T and Ninja Van are link-only; 17TRACK is a third-party lookup for
  SPX/LEX, not the carrier's API. TrackingMore create/get and live event mapping
  were verified with `JD282523205TH`.
- Return-carrier tracking is not connected to the returns module.

## iOS host notes

The SwiftUI host supplies platform adapters through simple Kotlin callback
classes, so Swift does not implement Kotlin suspend interfaces:

- `IosCrypto.swift` — CryptoKit AES-GCM plus CommonCrypto PBKDF2-HMAC-SHA256.
- `KeychainSecrets.swift` — Keychain generic-password storage for the device key.
- `DocumentPickerBackupFiles.swift` — export/import of encrypted backups.
- `Info.plist` — includes `CADisableMinimumFrameDurationOnPhone`; Compose aborts
  at startup without it.
- `ComposeView` does not ignore the safe area; the header sits below the status
  bar and the navigation bar above the home indicator.

The simulator launch is a runtime proof, not an App Store/device build. The
project has no signing team, entitlements, background modes, or share extension.

## Backup format and security notes

`EncryptedBackup` version 1 is a self-contained binary file: magic, version,
KDF cost, 16-byte salt, 12-byte nonce, creation time, and an AES-256-GCM
ciphertext. The header is authenticated as AAD. The password is expanded with
PBKDF2-HMAC-SHA256 to a 256-bit key; the key and password char array are zeroed
after use. The JSON snapshot contains all products, offers, observations, orders,
items, shipments, allocations, tracking events, preferences, return/refund records and decrypted
shipping addresses. Unknown JSON fields are rejected, and restore validates
uniqueness, references, quantities, currencies and domain invariants before
re-encrypting addresses with the local device key and replacing the database in
one transaction. Plaintext addresses exist only transiently in memory.

The encrypted envelope remains version 1. The JSON payload uses schema 4 for
order financials and still accepts schema-1 backups without returns, schema-2
backups without carrier ids and schema-3 backups without financials. `sync_meta`
is intentionally excluded and cleared by a full restore, so a restored device
must re-pair. Invalid return ownership, quantities, currencies, refund states,
carrier ids, order money and private fields are rejected before database
replacement. A multi-order round-trip regression test covers child-row insertion
order, return ownership, carrier id and financial preservation.

This format is not a substitute for an attacker with the live unlocked device,
and it does not provide key escrow. Keep the password out of the backup file.

## Next milestones

1. Finish iOS peer sync: iOS runtime verification, QR scanning and signing. See
   `docs/superpowers/plans/2026-10-28-ios-transport.md`. The iOS client transport
   is implemented and macOS-tested; Android QR/SAS/mDNS
   pairing, Devices UI and background sync are proven by instrumented tests;
   encrypted receipt attachments sync over TLS. Desktop syncs periodically while
   open. iOS background sync remains open.
2. Add PDF text extraction/OCR and email receipt import on top of the encrypted
   attachments, then reconcile totals against original payments.
3. Verify the Thailand Post adapter against a real account/tracking number, then
   add bounded retry/token caching and a carrier status-code mapping review.
4. Exercise iOS/desktop sensitive-field, backup file-picker, CSV-import and
   carrier-refresh interactions, then add iOS/desktop signing/notarization and
   store distribution.
5. Expand offers/variants, order editing and pagination, plus background tasks.

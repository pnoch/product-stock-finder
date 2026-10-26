# OmniShop native foundation

Clean-slate Kotlin/Compose rebuild. This is a working development foundation,
not the complete Phase 1 release from the master product brief.

## Implemented

- Shared Kotlin rules for integer minor-unit money, currency boundaries,
  overflow checks, and acquisition costs with explicitly unknown components.
- Canonical saved products with separate manually entered offers and initial
  price observations. Comparable offers are explicitly attached by the user;
  no fuzzy matching or automatic metadata extraction is claimed.
- Local manual purchase records with multiple line items, per-item package
  allocations, tracking numbers/carrier labels, manual event timelines, and
  derived partial delivery. A package defaults to the remaining quantity of
  each item; the user can split quantities across packages, and over-allocation
  is rejected by the domain and database.
- SQLDelight/SQLite transactions, foreign keys, indexes, bounded list queries,
  empty version-1/version-2 schema snapshots, and migration verification.
- Manual per-item return records with reasons, return tracking numbers, notes,
  all eight refund/return states, and exact minor-unit refund amounts. Received
  refund states require a positive amount; rejected requests release their
  reserved units. Return records are included in encrypted backups.
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

Real carrier/API requests, marketplace account connections, receipt/email import,
automatic metadata extraction, automatic product matching, automated returns/refunds,
cart/checkout, local notifications/background scheduling, peer sync, iOS
background tasks/share extensions, signing/notarization, and additional
sensitive fields are subsequent milestones.

The development SQLite database is not encrypted as a whole. The shipping
address is stored only as authenticated ciphertext; credentials and receipt
attachments have no input/storage path yet and require the same device-key
approach, not plaintext fallback columns. Encrypted portable backups protect
exported files, not the live database. The backup password is never stored;
losing it makes the file unreadable.

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
| Ktor HTTP URL utilities | 3.6.0; no HTTP client/API calls yet |

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
./gradlew :core:jvmTest :connectors:jvmTest :data:jvmTest :app:jvmTest
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
Preview application ID: `com.app.stocktrackerpro.nativepreview`. This separate,
debug-signed package installs alongside the old app; it is not a signed release
update and does not import the old application's data.

Linux packaged executable:
`desktopApp/build/compose/binaries/main/app/OmniShop/bin/OmniShop`.

## Platform proof

| Platform | Current evidence |
| --- | --- |
| Android | APK built and exercised on `emulator-5580`: saved/compare/order/partial-delivery/encrypted-address/return/partial-refund/restart/Thai, plus an in-place database upgrade; encrypted backup uses the system picker (unit-tested crypto/restore, picker not automated) |
| JVM on Linux | Tests, classes, packaged runtime, actual window startup under Xvfb; address cryptography uses the OS keyring (lazy; no keyring daemon under Xvfb) and backup uses a native file dialog (unit-tested) |
| Windows/macOS | `:desktopApp:createDistributable` succeeds on GitHub macOS and Windows runners; app-image contents are uploaded as CI artifacts. No interactive UI run on those OSes yet, and the installers are unsigned development builds |
| iOS | XcodeGen host builds and launches in a simulator on macOS CI; Compose UI renders, SQLite opens, CryptoKit backs backup/address encryption, Keychain stores the device key, and the document picker is wired. No device signing/App Store build, background tasks, share extension, or iOS UI automation beyond launch/screenshot |

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

`data/src/commonMain/sqldelight/databases/1.db` and `2.db` are empty generated
schema snapshots, with no test or user records. `1.sqm` upgrades a version-1
native database to version 2 by adding `order_return`; it does not recreate or
clear existing tables. A file-backed migration test preserves products/orders,
and an Android in-place APK upgrade preserved the existing order and encrypted
address before the clean smoke scenario was run.

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

The encrypted envelope remains version 1. The JSON payload now uses schema 2
for returns/refunds and still accepts earlier schema-1 native backups without
returns. Invalid return ownership, quantities, currencies, and refund states
are rejected before database replacement. A multi-order round-trip regression
test covers the child-row insertion order and return ownership validation.

This format is not a substitute for an attacker with the live unlocked device,
and it does not provide key escrow. Keep the password out of the backup file.

## Next milestones

1. Verify Thailand Post API access/credential suitability, then implement a real
   adapter with preserved raw events and provenance.
2. Exercise iOS/desktop sensitive-field and backup file-picker interactions,
   then complete signing/notarization and device distribution.
3. Expand offers/variants, order editing, pagination and receipt import.
4. Add encrypted credentials/receipt attachments using the same device key.
5. Native sharing/background tasks and encrypted peer synchronization.

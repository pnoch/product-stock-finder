# OmniShop native foundation

Clean-slate Kotlin/Compose rebuild. This is a working development foundation,
not the complete Phase 1 release from the master product brief.

## Implemented

- Shared Kotlin rules for integer minor-unit money, currency boundaries,
  overflow checks, and acquisition costs with explicitly unknown components.
- Canonical saved products with separate manually entered offers and initial
  price observations. Comparable offers are explicitly attached by the user;
  no fuzzy matching or automatic metadata extraction is claimed.
- Local manual purchase records, order items, split-package allocations,
  tracking numbers/carrier labels, manual event timelines, and derived partial
  delivery. The initial UI creates one order item with a chosen quantity;
  the core and SQLite schema support multiple items.
- SQLDelight/SQLite transactions, foreign keys, indexes, bounded list queries,
  an empty version-1 schema snapshot, and migration verification.
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
automatic metadata extraction, automatic product matching, returns/refunds,
cart/checkout, local notifications/background scheduling, peer sync, the iOS
Keychain adapter, and additional sensitive fields are subsequent milestones.

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
| `core` | Platform-independent values, cost rules, shipment progress, capabilities |
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
Gradle 9.4.1/SDK 36 are insufficient for this combination.

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

APK: `androidApp/build/outputs/apk/debug/androidApp-debug.apk`.
Preview application ID: `com.app.stocktrackerpro.nativepreview`. This separate,
debug-signed package installs alongside the old app; it is not a signed release
update and does not import the old application's data.

Linux packaged executable:
`desktopApp/build/compose/binaries/main/app/OmniShop/bin/OmniShop`.

## Platform proof

| Platform | Current evidence |
| --- | --- |
| Android | APK built and exercised on `emulator-5580`: saved/compare/order/partial-delivery/encrypted-address/restart/Thai; encrypted backup uses the system picker (unit-tested crypto/restore, picker not automated) |
| JVM on Linux | Tests, classes, packaged runtime, actual window startup under Xvfb; address cryptography uses the OS keyring (lazy; no keyring daemon under Xvfb) and backup uses a native file dialog (unit-tested) |
| Windows/macOS | Shared JVM code exists; OS-native packaging and integration unverified |
| iOS | KMP arm64/simulator targets declared; no Xcode host yet; not built or run on this Linux host |

`.github/workflows/native.yml` defines an Android/JVM gate and APK artifact.
It has not been run remotely until these changes are committed/pushed.

## Reproduce Android smoke evidence

Use an explicit emulator serial. `--reset` erases only the native preview's
database; omit it unless a clean smoke-test installation is intended. The full
scenario expects an empty English installation, so normally use a dedicated
emulator with `--reset`.

```bash
python3 scripts/smoke-android.py --serial emulator-5580 --reset
```

The script installs the APK, saves a product with two manually entered offers,
creates an order for two units, delivers one package, force-stops/reopens the
app, changes to Thai and repeats the restart assertion. It captures screenshots under `/tmp/opencode/omnishop-native-evidence/` and
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

`data/src/commonMain/sqldelight/databases/1.db` is an empty generated schema
snapshot. It contains no test or user records. For a future schema revision,
add SQLDelight numbered migrations and verify them against the prior snapshot;
never replace an existing user's database to make a test pass. No compatibility
with legacy Expo/Tauri data or old backup formats is required.

## Backup format and security notes

`EncryptedBackup` version 1 is a self-contained binary file: magic, version,
KDF cost, 16-byte salt, 12-byte nonce, creation time, and an AES-256-GCM
ciphertext. The header is authenticated as AAD. The password is expanded with
PBKDF2-HMAC-SHA256 to a 256-bit key; the key and password char array are zeroed
after use. The JSON snapshot contains all products, offers, observations, orders,
items, shipments, allocations, tracking events, preferences and decrypted
shipping addresses. Unknown JSON fields are rejected, and restore validates
uniqueness, references, quantities, currencies and domain invariants before
re-encrypting addresses with the local device key and replacing the database in
one transaction. Plaintext addresses exist only transiently in memory.

This format is not a substitute for an attacker with the live unlocked device,
and it does not provide key escrow. Keep the password out of the backup file.

## Next milestones

1. Verify Thailand Post API access/credential suitability, then implement a real
   adapter with preserved raw events and provenance.
2. Add the iOS host, its Keychain adapter, and Windows/macOS packaging proof.
3. Expand offers/variants, order editing, pagination and receipt import.
4. Add encrypted credentials/receipt attachments using the same device key.
5. Native sharing/background tasks and encrypted peer synchronization.

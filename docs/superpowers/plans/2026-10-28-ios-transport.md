# iOS Transport Plan

Status: Stages 1-3 implemented. The Kotlin bridge, Swift Keychain identity, TLS
client/host, pairing, bidirectional sync, Bonjour and BGTaskScheduler registration
are in place. Client and host paired/synced on macOS; Bonjour advertisement/browse
was verified with `dns-sd` and a separate browser process; the arm64 iOS app
builds, and an iOS simulator XCTest exercises host/client pairing and sync.
Background execution and the full Compose UI remain unverified on iOS.

## Goal

Give the iOS app the same direct, accountless peer sync as Android and desktop:

- per-device P-256 identity stored in the Keychain
- manual pairing code, QR-compatible payload, six-digit SAS
- mutually authenticated TLS with certificate pinning
- `settings`, `watchlist`, `orders` and encrypted receipt attachments
- optional mDNS/Bonjour discovery and nearby pairing
- background sync via `BGTaskScheduler`

The shared record engine and UI stay in Kotlin. Swift owns Apple platform APIs:
Keychain, certificate generation, `Network.framework`, Bonjour and background
tasks.

## Why macOS

This work needs Xcode, the iOS SDK, `Network.framework`, Keychain entitlements and
an iOS simulator or device. It cannot be built or runtime-tested in the Linux
workspace. CI can compile and run simulator tests on `macos-latest`.

## Current State

- `SyncService` is the UI-facing interface in `data/src/commonMain`.
- `TlsSyncService` implements the protocol on JVM/Android.
- `SyncEngine`, `SyncBatch`, `SyncChange`, `SyncResult`, `SyncPairingCode` and
  `SyncDiscoveredPeer` are shared Kotlin types.
- iOS currently uses `UnavailableSyncService` in
  `app/src/iosMain/kotlin/com/omnishop/app/MainViewController.kt`.
- The iOS host is SwiftUI + XcodeGen under `native/iosApp`.
- `DevicesPanel` already handles pairing, SAS, nearby devices, sync and revoke.

## Architecture

Use a Kotlin adapter around a Swift transport.

```
DevicesPanel (Kotlin/Compose)
        |
   SyncService (Kotlin)
        |
 IosSyncService (Kotlin adapter)
        |  local batches / apply
 IosSyncTransport (Kotlin interface, implemented in Swift)
        |
 Network.framework + Security + Keychain + Bonjour
```

### Kotlin side

Add `IosSyncTransport` in `app/src/iosMain`:

```kotlin
interface IosSyncTransport {
    fun thisDevice(): SyncDeviceInfo
    fun peers(): List<SyncPeerInfo>
    fun discoveredPeers(): List<SyncDiscoveredPeer>
    fun createPairing(completion: (SyncPairingCode?, String?) -> Unit)
    fun pair(code: String, completion: (SyncResult) -> Unit)
    fun sync(peerId: String, local: SyncBatch, completion: (SyncBatch?, String?) -> Unit)
    fun revoke(peerId: String)
    fun close()
}
```

Add `IosSyncService : SyncService` that:

- delegates `thisDevice`, `peers`, `discoveredPeers` and `revoke`
- bridges callbacks to coroutines with `suspendCancellableCoroutine`
- builds the local `SyncBatch` through `SyncEngine.localChanges`
- passes that batch to the transport
- applies the returned remote batch with `SyncEngine.apply`
- returns `SyncResult.Success(applied, sent)` or `Failure(message)`
- calls `store.setOriginDevice(transport.thisDevice().deviceId)` before use

`MainViewController` gains a `syncTransport: IosSyncTransport?` parameter. When
present it creates `SyncEngine(store, receiptService)` and `IosSyncService`;
otherwise it keeps `UnavailableSyncService`. Swift passes an
`IosSyncTransport` implementation from `ComposeView`.

### Swift side

Implement `IosSyncTransport` in `iosApp/OmniShop/IosSyncTransport.swift`:

- identity and certificate lifecycle
- peer persistence
- pairing code encode/decode and SAS
- `NWConnection` client
- `NWListener` server
- length-prefixed JSON framing
- optional Bonjour advertise/browse
- background sync registration

## Identity

Use CryptoKit P-256 plus a self-signed X.509 certificate generated with
`swift-certificates`:

- key: P-256, non-exportable where possible, Keychain
  `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`
- certificate: `CN=OmniShop Device`, 10-year validity
- import key and certificate into the Keychain; obtain `SecIdentity`
- persist only Keychain references plus the certificate DER

Derivations must match JVM exactly:

- `deviceId` = base64url(no padding) of the first 16 bytes of
  SHA-256(SubjectPublicKeyInfo DER)
- `fingerprint` = lowercase hex SHA-256(certificate DER)
- SAS = first 4 bytes of HMAC-SHA256(secret, `hostFingerprint|clientFingerprint`),
  modulo 1,000,000, zero-padded to six digits, displayed as `123 456`

Add a cross-platform fixture test: the same certificate must produce the same
device id and fingerprint in JVM and Swift. JVM uses
`certificate.publicKey.encoded`; Swift must hash the SPKI, not the raw EC point.

Keychain keys:

- `sync.identity.v1` identity reference or PKCS#12-equivalent payload
- `sync.peers.v1` JSON peer list
- `sync.background.v1` optional scheduling metadata

## TLS

Use `Network.framework` with TLS 1.2+ and mutual authentication.

Server:

- `NWListener` on 8787 (or 0 in tests)
- `sec_protocol_options_set_local_identity`
- `sec_protocol_options_set_peer_authentication_required(true)`
- accept a client certificate during pairing only, then require a pinned peer
  fingerprint for sync

Client:

- `NWConnection` to `host:port`
- local `SecIdentity`
- verify block compares SHA-256(certificate DER) to the pinned fingerprint
- reject mismatches before sending any pairing or sync data

Pairing code payload is base64url JSON:

```json
{"version":1,"deviceId":"…","fingerprint":"…","host":"192.168.1.20","port":8787,"secret":"…","expiresAt":1790000000000}
```

Rules:

- secret: 16 random bytes, base64url, five-minute lifetime
- host stores the secret only in memory until paired or expired
- no secret in mDNS or QR metadata beyond the QR payload itself
- SAS must match on both sides or the joiner discards the peer

## Framing

Use the existing wire format exactly:

- 4-byte big-endian length
- UTF-8 JSON
- maximum 32 MiB
- `WireMessage` fields: `type`, `secret`, `deviceId`, `name`, `fingerprint`,
  `sas`, `batch`, `message`
- `SyncBatch` contains `changes` and `cursor`
- `SyncChange` contains `collection`, `id`, `updatedAt`, `originDevice`,
  `deletedAt`, `payload`

Swift `Codable` structs must preserve optional fields and Kotlin serialization
names. Add round-trip fixtures generated by JVM.

## Bonjour

Service type: `_omnishop._tcp.local.`

TXT keys:

- `v=1`
- `id=<deviceId>`
- `fp=<fingerprint>`
- `name=<display name>`
- `expires=<epoch millis>`

Advertise only while a pairing window is open. Never advertise the secret.
Browse with `NWBrowser`; filter the local device id and expired records. Nearby
pairing still requires the short secret and SAS comparison.

Add to `Info.plist`:

- `NSLocalNetworkUsageDescription`
- `NSBonjourServices` = `_omnishop._tcp`

## Background Sync

Stage after foreground transport works:

- register `BGAppRefreshTask` and `BGProcessingTask`
- sync known peers without starting a listener
- schedule on app background and after successful sync
- skip when no peers or no network
- keep Android WorkManager behavior unchanged

## Delivery Stages

### Stage 1: Bridge and client-only transport

- Kotlin bridge implemented as `CallbackSyncTransport` + `CallbackSyncService`
  with JVM tests; Swift `IosSyncTransport` remains
- add Swift identity, pairing code, SAS and `NWConnection` client
- pair and sync iOS to desktop/Android
- keep `NWListener` disabled; iOS cannot accept inbound connections yet
- simulator test against the desktop harness or a second transport

### Stage 2: Listener and inbound sync

- add `NWListener` TLS server
- accept pairing requests and sync connections
- persist peers and revoke
- test iOS↔desktop and iOS↔iOS on simulator/device

### Stage 3: Bonjour and QR

- add `NWBrowser`/`NWListener` Bonjour
- add nearby pairing with short secret
- add AVFoundation QR scanner and pass the scanned code into `DevicesPanel`

### Stage 4: Background and release

- add BGTask scheduling
- add Keychain/local-network entitlements
- add iOS signing and TestFlight/App Store packaging
- add release runbook and privacy strings

## Tests

Swift unit tests:

- device id and fingerprint match JVM fixture
- pairing code encode/decode and expiry
- SAS vector matches JVM
- wire framing round-trip and size cap
- pinning rejects a wrong certificate

Integration:

- iOS simulator client pairs and syncs with desktop harness
- iOS listener accepts desktop/Android client
- iOS↔iOS pair, sync, revoke
- receipt attachment sync
- mDNS discovery and nearby pairing
- background task registration (not a real OS schedule)

Cross-platform:

- JVM-generated code decoded on iOS
- iOS-generated code decoded on JVM
- same record batches produce identical LWW results

Add a macOS CI job:

```bash
xcodebuild test -project iosApp/OmniShop.xcodeproj -scheme OmniShop \
  -destination 'platform=iOS Simulator,name=iPhone 16'
```

## Risks

- Swift↔Kotlin callback bridging and suspend adaptation
- X.509 generation and SPKI/device-id parity with JVM
- `Network.framework` client-certificate and pinning behavior
- iOS local-network privacy prompt and simulator multicast limits
- 32 MiB frame limit versus large receipt attachments
- background execution limits
- App Store review for local-network discovery

## Acceptance Criteria

- iOS pairs with Android and desktop using code/QR and SAS
- iOS syncs settings, watchlist, orders and receipts both ways
- equal-timestamp conflicts resolve with the real device id
- iOS can revoke a peer and be revoked
- mDNS nearby pairing works without broadcasting the secret
- iOS background sync runs when the OS permits
- JVM and iOS produce the same device id, fingerprint and SAS for fixtures
- all existing JVM/Android tests remain green

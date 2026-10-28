# OmniShop encrypted peer sync — design

Date: 2026-10-27

Status: approved. Implementation is staged. The record engine for settings,
watchlist, order aggregates and encrypted receipt attachments, a manual
encrypted sync package, and a desktop + Android TLS peer transport with
pairing/Devices UI, SAS confirmation, QR pairing (display everywhere, Android
scan), JVM/Android mDNS discovery and Android/desktop periodic sync are
implemented. iOS now has client/host Swift transports, Bonjour discovery
(advertisement/browse verified on macOS) and `BGTaskScheduler` registration; an
iOS simulator host/client test target exists but is not yet stable in CI.
Background execution remains unverified. The iOS implementation plan is
`docs/superpowers/plans/2026-10-28-ios-transport.md`.

## Goal

Let two or more OmniShop devices synchronize shopping data directly, with no
OmniShop account, hosted user database, relay, or desktop requirement. Android
and iOS must work without a desktop; the desktop is an optional peer.

This is a new subsystem, not an extension of the old TypeScript sync engine. The
native app currently has no device identity, pairing, transport, operation log,
or conflict handling.

## Delivery stages

1. **Record engine (implemented):** `sync_meta`, settings/watchlist/order
   aggregate payloads, LWW/tombstones/cursors, transactional write hooks and
   loopback tests.
2. **Orders aggregate (implemented):** order + items + shipments + allocations +
   events + returns as one validated sync record; local private fields survive a
   remote order update.
3. **Manual encrypted sync package (implemented interim):** export/import with a
   password and LWW merge; not peer-to-peer and no device identity.
4. **Desktop + Android identity/pairing/transport (implemented):** EC P-256
   self-signed identity, manual one-time pairing code, pinned TLS server/client,
   peer store, Devices UI and revocation. iOS has client/host Swift transports,
   Bonjour and background-task registration.
5. **iOS runtime verification, QR scanning and signing (next).**
   The iOS client/host transport, Bonjour, background scheduling, QR pairing, SAS confirmation, JVM/Android mDNS
   discovery, Android WorkManager/desktop periodic sync and encrypted receipt
   attachment sync are implemented.

The original first-milestone scope below is the target for the transport stage;
it is not claimed as complete by the record engine alone.

## Scope of the first milestone

- Device identity and human-verifiable pairing.
- Direct LAN transport between **Android and desktop** first; iOS transport is a
  follow-up using the same protocol.
- Record-level sync of watchlist, alerts, reminders and settings.
- Deterministic conflict resolution and tombstones.
- Device revocation and selective collection sync.
- No cloud fallback, no account. Android schedules periodic WorkManager sync; iOS
  has no sync while the app is closed.

Explicitly out of scope for the first milestone:

- Product images and other large attachments. Receipt/document bytes are now
  synced as encrypted private-field payloads.
- Remote sync over the internet; users may provide their own network.
- Multi-user sharing, shared watchlists, or a relay.
- Background/always-on synchronization.
- iOS transport (design compatibility required, implementation later).

A later release gate requires the same protocol on iOS and encrypted attachment
transfer before “peer sync” can be called complete.

## Threat model

Protect against:

- a passive or active attacker on the LAN;
- a device that was revoked or whose pairing expired;
- replay, reordering, truncation and tampering of sync messages;
- a peer sending malformed records or references to unknown parents;
- silent data loss from an ambiguous merge.

Not protected against:

- a compromised OS or a device that is already unlocked and compromised;
- a user intentionally exporting data;
- traffic-analysis metadata (connection times, approximate sizes);
- loss of a device key (the user must re-pair; encrypted backups do not contain
  device identity keys).

## Transport decision

Use **TLS 1.3 with pinned, ephemeral self-signed device certificates**. Do not
invent a cryptographic protocol. Pairing carries the peer certificate
fingerprint and a one-time high-entropy pairing secret; the TLS handshake is
followed by a short authentication string (SAS) that both users compare.

Transport implementations:

- JVM/Android: Ktor server + client or OkHttp TLS.
- iOS: `Network.framework` listener + URLSession/Network client.
- Desktop: the JVM implementation.

The shared module owns the sync protocol and record validation; platform code
owns sockets, certificates and discovery. Certificates are generated at pairing
time and stored in the platform SecretStore/Keychain; they are not committed or
included in backups.

**Rejected:** a custom Noise-like handshake, plaintext HTTP, cloud relay, and
copying live database files.

Discovery starts with a manual IP/port (and QR containing the endpoint). mDNS/
Bonjour discovery is a later convenience; it must not be required for pairing.

## Device identity and pairing

- Each install generates an Ed25519 identity keypair in the platform SecretStore.
- `deviceId = base64url(SHA-256(publicKey))` truncated to 128 bits.
- A device name is user-editable and is not identity.
- Pairing code/QR contains: protocol version, deviceId, certificate fingerprint,
  LAN endpoint, one-time secret, expiry. It is valid for five minutes and can be
  used once.
- Flow:
  1. A opens **Devices → Pair** and shows the QR/code.
  2. B scans/enters it; both open TLS with pinned fingerprints.
  3. Both display the same SAS; the user confirms on both devices.
  4. B sends its identity certificate/public key; A stores it as a trusted peer.
  5. Initial sync runs; either side can cancel.
- A failed SAS comparison aborts and deletes the pairing material.
- Pairing secrets, private keys and peer certificates never enter logs,
  backups or the database as plaintext.

## Record-level sync

Add a `sync_meta` table keyed by `(collection, id)`:

```text
collection      watchlist | alerts | reminders | settings
id              domain record id
updated_at      logical revision timestamp (serverless, device clock)
origin_device   device that produced the revision
deleted_at      tombstone timestamp or null
```

Every local repository write must update `sync_meta` in the **same SQLite
transaction** as the record. Reads for sync use a cursor over
`(updated_at, origin_device, id)`. Tombstones are retained for at least 90 days
and are exchanged like records.

A sync session is:

1. Authenticate and confirm the peer is not revoked.
2. Exchange protocol version and selected collections.
3. Pull remote operations since the peer cursor; validate and apply.
4. Push local operations since the peer cursor.
5. Persist both cursors only after the peer acknowledges the batch.

Messages are bounded and batched. No partial batch is acknowledged; applying a
batch and advancing the cursor is one local transaction.

### Conflict resolution

- Whole-record LWW by `updated_at`; tie-break by `origin_device` (lexicographic)
  and then `id`. This is deterministic on every device.
- Tombstones beat older live records; a newer live record resurrects an id.
- Settings are one record per key, same rule.
- Watchlist listings are not field-merged across devices in the first milestone;
  the winning whole product record is applied, preserving local-only listings
  through the existing apply policy only when it is safe. A conflict that would
  drop a local listing must be reported, not silently merged.
- Alerts/reminders that reference a deleted product are kept but flagged for
  user review; they are not silently deleted.

Clocks are not trusted. A peer can send a far-future `updated_at`; the receiver
rejects revisions more than five minutes ahead of its own clock and reports the
peer as unsynchronized. LWW is a coordination mechanism, not a security boundary.

## Validation and limits

- Reuse domain constructors and backup validators for every incoming record.
- Reject unknown collections, unknown fields, oversized payloads, invalid
  references, duplicate ids in a batch, and malformed timestamps.
- Per-session limits: max records per batch, max bytes per batch, max batch
  count; the limits live in `shared/const` or a shared sync constants file and
  both sides enforce them.
- Never apply a record without its `sync_meta` update; never advance a cursor on
  a failed apply.

## Selective sync and revocation

- Per-peer collection selection: watchlist, alerts, reminders, settings.
- Revoking a peer removes its trusted key/certificate and cursor, and rejects
  future handshakes. It does not remotely wipe the peer's existing data.
- Removing a device locally does not require the other device to be online.
- Re-pairing creates new keys and a new pairing id; old cursors are not reused.

## Attachments and images (later milestone)

Receipts, product images and large blobs are **not** in the first sync protocol.
When added, they need content-addressed, chunked, resumable transfer with the
same pinned TLS channel, explicit user consent, size limits and local cache
eviction. They must not be embedded in JSON records.

## UI

Profile → Devices:

- This device: name, device id (short), “Pair device”.
- Paired devices: name, last sync, selected collections, revoke.
- Pairing: QR/code, endpoint, SAS confirmation, cancel.
- Sync status: last attempt, last success, counts, errors; no fake “synced”
  state when a batch failed.

Orders/Saved screens do not block on sync; local-first remains the default.

## Storage and backups

New tables: `sync_peer`, `sync_cursor`, `sync_meta`. They contain identities,
certificates and revision metadata, not plaintext message history.

Device identity keys and peer certificates are excluded from encrypted backups.
Backups continue to carry the shopping records; restoring a backup on a new
device creates a new identity and requires re-pairing.

## Tests and acceptance

- Identity generation, QR/code expiry, single-use pairing, SAS mismatch abort.
- TLS certificate pinning and revoked-peer rejection.
- Replay, reorder, truncation, tampering and oversized-batch rejection.
- LWW tie-breaks, tombstones, resurrection, cursor atomicity.
- Repository writes update `sync_meta` transactionally.
- Selective sync and revocation.
- Two-device emulator/desktop test: add/update/delete on each side, reconnect,
  verify convergence; offline changes sync on reconnect.
- Android ↔ desktop first; iOS transport later with the same vectors.
- No cloud endpoint or account is used.

## Implementation sequence after approval

1. Add device identity, `sync_meta` and transactional write hooks; tests.
2. Implement the sync protocol and validation in a shared module; loopback tests.
3. Add Android/desktop TLS transport and manual pairing; two-device test.
4. Add the Devices UI and selective sync/revocation.
5. Add iOS transport and QR/Bonjour discovery.
6. Add attachment transfer and background sync as separate milestones.

## Current implementation (2026-10-27)

- `sync_meta(collection, id, updated_at, origin_device, deleted_at)` plus cursor
  index; database schema 5 (`4.sqm`).
- Hooks mark `settings` on `setPreference`/`deletePreference` and `watchlist` on
  `saveProduct`/`saveOffer`/`deleteProduct`.
- `SyncEngine` emits and applies LWW changes with `(updated_at, origin_device)`
  tie-breaking and tombstones; settings, watchlist and order aggregate payloads
  are validated and applied in one SQLite transaction. Order updates preserve
  local private address/receipt fields.
- `sync_meta` is excluded from encrypted backups and cleared by a full restore;
  a restored device must re-pair.
- Desktop/Android have device identity, pairing, TLS transport, Devices UI,
  selective collection sync, revocation, mDNS discovery and periodic sync. iOS
  has client/host transports, Bonjour and background scheduling; runtime is open. `TlsSyncService` injects its identity
  device id into `ShoppingStore`, so local writes use the real device id for
  equal-timestamp LWW tie-breaking; iOS remains local-only.
- A JVM loopback proof (`TlsTransportTest`) generates EC P-256 self-signed
  certificates, performs mutual TLS with certificate pinning, exchanges a framed
  payload, and verifies a wrong pin is rejected. This is a transport spike, not
  a production server/client; EC P-256 is used because JVM/Android support is
  reliable, while Ed25519 identity remains a target to validate per platform.
- A manual encrypted sync package (`SyncPackageService`) exports current records
  (including tombstones) and LWW-merges them on import. It is a user-mediated file,
  not peer-to-peer, and creates no device identity or trust.
- `TlsSyncService` (JVM shared by desktop and Android) binds port 8787,
  creates/loads a PKCS12 identity in SecretStore, emits a one-time manual pairing
  code (5 minutes), pins the peer certificate, stores peers in SecretStore, syncs
  both ways, displays a six-digit SAS for both users to compare and supports
  revocation. The pairing code renders as a QR on all platforms; Android can scan
  it, while iOS/desktop scanning remains open. Desktop and Android advertise a
  pairing window over mDNS (`_omnishop._tcp.local.`) with only public identity,
  endpoint and expiry; the joiner enters the short pairing secret shown by the
  host. No secret is broadcast. iOS has client/host transports and Bonjour.
  Android compiles and runs the same code. An Android↔desktop runtime
  pairing attempt exposed duplicate `MainActivity` instances holding port 8787;
  `MainActivity` is now `singleTask` and `adb reverse` is verified. An Android
  instrumented test proves Keystore identity, TLS pairing, SAS and record sync
  against the desktop harness; a Compose UI test proves the Devices pairing/sync
  flow, and an Android instrumented test proves mDNS discovery and nearby pairing.
  Receipt attachments sync through the same encrypted payload. Android schedules WorkManager sync every six hours; desktop
  syncs periodically while open; iOS has no background sync.
- Tests: 119 JVM tests and three Android instrumented tests pass, including sync LWW/tombstones/cursors, malformed
  payload rejection, watchlist/order aggregate round-trips, private-field
  preservation, the 4→5 migration, TLS pinning, pairing/sync/revocation and
  sync-package merge/idempotency/wrong-password tests.

## Open decisions

- TLS server stack on Android/desktop and Network.framework details on iOS.
- QR scanning dependency vs. manual code first.
- Exact batch/cursor limits.
- Whether product-listings conflicts need a user-facing review queue in the first
  milestone.

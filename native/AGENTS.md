# OmniShop native rebuild

This is a clean Kotlin/Compose application, independent of the Expo/Tauri app.
See `README.md` for the verified feature/platform matrix and exact commands.

- Keep business rules in `core`, SQLDelight transactions in `data`, URL/source
  adapters in `connectors`, presentation in `app`, and OS APIs in entry points.
- No mandatory backend, account, token broker, telemetry, or desktop dependency.
- Use minor-unit integers for money. Unknown fees are not zero. Never silently
  merge product variants, orders, or tracking observations.
- New installs start empty. Fixtures belong in test source sets only.
- Do not mark a connector live without actual authorized requests and provenance.
  Thailand Post is implemented but live access is unverified; the only proof is
  MockEngine tests plus the UI's unconfigured gate.
- Preserve original event descriptions/timestamps and manual/provider attribution.
- Run the native tests and compile affected platforms before claiming success.
  Linux cannot prove iOS, Windows, or macOS packaging.
- The preview package is separate from the old app. Do not replace the shared
  release APK/page with this development preview without a user request.
- Release signing uses the existing gitignored keystore/properties; never commit
  keys, signed APKs, `.deb`/installer artifacts, or generated distribution files.
  The native preview remains `com.app.stocktrackerpro.nativepreview`; do not
  change the package id or signing key without an explicit migration decision.
- Never commit a local database containing user records, local.properties,
  signing keys, build output, or Gradle caches. SQLDelight `databases/*.db`
  files are empty schema snapshots, not exported user databases; retain the
  previous snapshot and add a numbered `.sqm` migration for schema changes.
- Sync is staged: the `settings`/`watchlist`/`orders` record engine, a manual
  encrypted sync package, and a **desktop-only** TLS peer transport exist. Every
  syncable write updates `sync_meta` in the same transaction; remote changes use
  LWW `(updated_at, origin_device)` and tombstones, and are applied with payload
  validation in one transaction. Never mark a UI as synced, claim peer transport,
  or include `sync_meta` in backups until identity/pairing/TLS and order sync
  actually exist. The manual sync package is an encrypted file with LWW merge,
  not peer-to-peer, and must not be labeled as automatic/peer sync. The desktop
  JVM transport is real (TLS, pinned certs, pairing, Devices UI, revocation);
  Android/iOS must keep `UnavailableSyncService` until their transports exist,
  and the UI must not claim cross-platform sync. Order sync
  replaces child items/shipments/events/returns but
  must preserve local private fields (address/receipts) by updating the order row
  instead of deleting it. `origin_device` is `"local"` until a real device
  identity is introduced.
- The iOS host lives in `iosApp/` (XcodeGen `project.yml` + Swift). Do not commit
  the generated `.xcodeproj`. `Info.plist` must keep
  `CADisableMinimumFrameDurationOnPhone=true`; Swift supplies CryptoKit,
  Keychain, and document-picker adapters through the `Ios*Callbacks` classes.
  Keep the shared UI inside the safe area; do not ignore it.
- Encrypted backups use the v1 authenticated format in
  `data/.../security/EncryptedBackup.kt`. Do not add an unauthenticated fallback,
  store the password, or change KDF/AEAD parameters without a version bump and
  tests for wrong password, tampering, truncation, and atomic restore rollback.
  Keep the live database plainly labeled: only the shipping address is encrypted.
- Sensitive fields go through `OrderPrivateService` / `SecretStore`. Never add a
  plaintext column, an in-memory-only key, or a file-based key fallback. Android
  uses a non-exportable Keystore key; desktop uses the OS credential store and
  fails closed when unavailable. Backups carry decrypted sensitive values only
  inside the password-encrypted snapshot and re-encrypt with the local key.
- Return quantities and ownership use `validateOrderReturns` in `core` for both
  repository writes and backup restore. Rejected requests release reserved units.
  Use long sums, preserve refund currency, and never imply a manual record sends
  a merchant request or transfers money. Database schema 2 and backup payload
  schema 2 add returns; database schema 3 adds `shipment.carrier_id` and backup
  payload schema 3 carries it. The authenticated backup envelope is still
  version 1.
- Carrier credentials live in `CarrierSettings`/`SecretStore`; never persist or
  log API tokens. Carrier HTTP belongs in `carriers`, with the adapter receiving
  the key explicitly. Preserve raw descriptions/timestamps and mark provider
  provenance; do not fabricate events or claim live verification. Carrier
  locations are currently appended to the description, not a separate column.
- Receipts are encrypted private fields (`ReceiptService`) under the order, not
  a separate plaintext table. Keep the 8 MB receipt cap, the 12 MB private-field
  cap, and backup inclusion. Never write receipt bytes to disk unencrypted or log
  their names/contents. Receipt names/MIME types are sanitized; listing must not
  Base64-decode content. PDF/OCR/email parsing is not implemented.
- Order money (`PurchaseOrder.currency`, item prices, shipping/tax/discount/total)
  must share one currency; the recorded total is independent of the computed
  total so a mismatch stays visible. Never store card data; only a payment-method
  label. CSV import validates every row and inserts the batch transactionally;
  duplicate merchant order IDs are reported and skipped, never silently merged.
  CSV input is capped at 10 MB / 50,000 rows with field-length limits. Database/
  backup schema 4 adds financial fields.
- Link-only carriers (`CarrierLinks`) must stay labeled link-only. SPX/LEX use
  a clearly identified 17TRACK lookup, not a carrier API; KEX/Flash/J&T/Ninja Van
  open their own tracking pages. Never generate events from a link or imply it is
  live tracking. The user must confirm the carrier; marketplace names are not
  proof of the last-mile carrier.

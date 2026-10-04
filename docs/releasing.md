# Release Runbook

How to cut and ship Product Stock Finder. Two build targets share one version
number: **mobile/web** (Expo) and **desktop** (Tauri). `tests/version-lockstep.test.ts`
enforces that `package.json`, `app.config.ts`, `desktop/package.json`,
`desktop/src-tauri/tauri.conf.json`, `Cargo.toml` and `Cargo.lock` agree, so bump
them together (see [Version bump](#1-version-bump)).

Everything here runs from the repo root unless noted. `android/`, `ios/`,
`dist/`, `dist-web/`, `credentials/`, `.env*` are gitignored.

---

## 0. One-time setup (do once per machine / org)

### Android signing keystore

```bash
scripts/android-keystore.sh
```

Writes (gitignored) `credentials/release.keystore` + `credentials/keystore.properties`
(`storeFile=../../credentials/release.keystore`). It prints the **SHA-256**
fingerprint — save that; it's needed for App Links. `plugins/with-android-release-signing`
re-applies the Gradle signing config on every `expo prebuild` (otherwise a
prebuild falls back to the debug key, which Play rejects).

**Back up the keystore now.** Losing it means the app can never be updated on
Play under the same package name.

### Desktop updater signing key

```bash
cargo tauri signer generate -w ~/.tauri/psf-updater.key -p ""
```

Put the printed/`~/.tauri/psf-updater.key.pub` **public** key into
`desktop/src-tauri/tauri.conf.json` → `plugins.updater.pubkey`, and add the
**private** key as a GitHub repo secret `TAURI_SIGNING_PRIVATE_KEY` (optionally
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD`). `bundle.createUpdaterArtifacts` is on, so
until the real pubkey is set a `tauri build` fails closed (the placeholder isn't
valid base64).

### Android push (FCM)

Remote push on Android needs Firebase credentials. Either:
- EAS-managed: `eas credentials` → Android → Google Service Account (upload the FCM key); or
- repo file: drop `google-services.json` in and set
  `android: { googleServicesFile: "./google-services.json" }` in `app.config.ts`.

Without this, local notifications and foreground price checks still work; only
server/remote push no-ops.

---

## 1. Version bump

```bash
# 5.17.0 -> 5.18.0 (minor) or 5.17.1 (patch)
# edit all six in lockstep:
#   package.json, app.config.ts, desktop/package.json,
#   desktop/src-tauri/tauri.conf.json, desktop/src-tauri/Cargo.toml
# then reconcile the lock:
cargo check --manifest-path desktop/src-tauri/Cargo.toml   # updates Cargo.lock
```

Add a `CHANGELOG.md` section headed `## [<version>] - <date>`. Verify:

```bash
pnpm exec vitest run tests/version-lockstep.test.ts
```

---

## 2. Pre-flight (always)

```bash
pnpm verify        # check + lint + test + check:desktop + desktop test + cargo test
```

If you touched `server/` or `shared/`, run the DB suite too (Docker):

```bash
docker run -d --name psf-mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=psf_test -p 3306:3306 mysql:8.4
DATABASE_URL=mysql://root:root@127.0.0.1:3306/psf_test pnpm db:push
RUN_DB_TESTS=1 TEST_DATABASE_URL=mysql://root:root@127.0.0.1:3306/psf_test pnpm test:db
```

### App Links / deep links

Set `EXPO_PUBLIC_WEB_URL` (e.g. `https://app.example.com`) in `.env` **before**
bundling, so `app.config.ts` emits the `https://<host>` intent filter with
`autoVerify` (and the iOS `associatedDomains`). It falls back to
`EXPO_PUBLIC_API_BASE_URL`, and if neither is set there is no https App Link.

On the server, set `ANDROID_SHA256_CERT_FINGERPRINTS` (comma-separated SHA-256
from the keystore) so `/.well-known/assetlinks.json` is served; App Links won't
verify without it. (Apple equivalent: `APPLE_TEAM_ID` for the AASA file.)

Env changes are baked at bundle time and Metro caches transforms — rebuild with
`--clear` / `--reset-cache` after changing `EXPO_PUBLIC_*`.

---

## 3. Android release (APK)

`android/` is generated, so prebuild first, then build:

```bash
npx expo prebuild --platform android          # re-applies all config plugins
pnpm build:apk                                 # cd android && ./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk` (signed with
`credentials/release.keystore`, R8-minified, hardened: scoped cleartext,
no `SYSTEM_ALERT_WINDOW`, `allowBackup=false`, scoped storage perms).

Verify before uploading:

```bash
APK=android/app/build/outputs/apk/release/app-release.apk
"$ANDROID_HOME"/build-tools/*/apksigner verify --print-certs "$APK"   # CN=Product Stock Finder
"$ANDROID_HOME"/build-tools/*/aapt dump badging "$APK" | grep ^package:
```

Upload to Play Console (internal track). `versionCode` is whatever
`android/app/build.gradle` has after prebuild; Play requires it to increase per
upload. **EAS alternative:** `eas build -p android --profile production`
(`eas.json` has `autoIncrement: true`) + `eas submit -p android`.

> Standalone behaviour: a release build with a loopback `EXPO_PUBLIC_API_BASE_URL`
> (e.g. the dev `http://localhost:3000`) runs local-only on-device; prices come
> from on-device scraping in a hidden WebView while the app is open.

---

## 4. Desktop release (Tauri)

Tag-triggered, all platforms. Bump the version first (step 1) and make the tag
match `tauri.conf.json`:

```bash
git tag v5.18.0
git push origin v5.18.0
```

`.github/workflows/release.yml` (tauri-action) then builds macOS (universal),
Linux and Windows, signs with `TAURI_SIGNING_PRIVATE_KEY`, and uploads the
installers + `latest.json` to the GitHub Release. The release is created as a
**draft** — publish it so it becomes `latest`, which is what the updater
endpoint points at:

```
https://github.com/pnoch/product-stock-finder/releases/latest/download/latest.json
```

`plugins.updater.requireSignedVersion` is on, so the artifact signature must
carry the version (built by a current tauri-cli).

Manual/local build (Linux leg):

```bash
cd desktop
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/psf-updater.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
  cargo tauri build            # add --bundles deb to skip AppImage tooling
# artifacts under desktop/src-tauri/target/release/bundle/
```

The in-app **Settings → About → Updates** row checks the endpoint and installs
an available update (Windows exits to install; macOS/Linux apply on restart).

---

## 5. Web deploy

```bash
pnpm build          # esbuild server bundle (dist/) + expo web export (dist-web/)
pnpm start          # production server; serves dist-web at / with SPA fallback
```

The API server hosts `dist-web/` same-origin (`server/spa.ts`). Web release
builds are `output: "single"` (SPA); don't switch to `static` (NativeWind
hydration mismatch). Web push needs `VAPID_*` (server) +
`EXPO_PUBLIC_VAPID_PUBLIC_KEY` (client).

---

## 6. Post-release checklist

- [ ] `pnpm verify` green on the release commit.
- [ ] `CHANGELOG.md` has the version; version lockstep test passes.
- [ ] Android APK signed by `CN=Product Stock Finder`; `versionCode` increased.
- [ ] `assetlinks.json` returns 200 and lists the release SHA-256.
- [ ] Desktop `latest.json` published (not draft) and the app's update check finds it.
- [ ] Tag pushed; `main` pushed.

## Troubleshooting

- **`tauri build` fails to decode the pubkey** → `plugins.updater.pubkey` is still the placeholder; set the real minisign public key.
- **App Links don't open the app** → `EXPO_PUBLIC_WEB_URL` not set at bundle time, or `ANDROID_SHA256_CERT_FINGERPRINTS` missing/mismatched.
- **Android remote push silent** → no FCM credentials (step 0).
- **Release APK rejected by Play** → built with the debug key; ensure `credentials/keystore.properties` exists before `expo prebuild`.

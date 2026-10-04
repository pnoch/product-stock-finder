#!/usr/bin/env bash
# Deterministic Android release APK.
#
# Why this exists: Expo's Gradle JS-bundle task (`:app:createBundleReleaseJsAndAssets`)
# can serve a STALE bundle — it does not reliably pick up source or EXPO_PUBLIC_*
# changes even with `--reset-cache`/`--rerun-tasks`/`clean` (see todo Phase 1063).
# So this always rebundles via `expo export:embed --reset-cache` and repacks the
# built APK with that fresh bundle, then re-signs with credentials/release.keystore.
#
# Requires: ANDROID_HOME (Android SDK), credentials/keystore.properties + release.keystore.
# The API base / server URL comes from the environment (EXPO_PUBLIC_*), so for a
# standalone build leave EXPO_PUBLIC_API_BASE_URL unset.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -z "${ANDROID_HOME:-}" ]]; then
  echo "build-apk: ANDROID_HOME is not set" >&2
  exit 1
fi

APK_DIR="android/app/build/outputs/apk/release"
BASE_APK="$APK_DIR/app-release.apk"
OUT_APK="$APK_DIR/app-release-standalone.apk"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "==> Native build (base APK)"
( cd android && ./gradlew assembleRelease )

echo "==> Fresh JS bundle (reset cache)"
pnpm exec expo export:embed \
  --platform android --dev false --reset-cache \
  --entry-file node_modules/expo-router/entry.js \
  --bundle-output "$WORK/bundle/index.android.bundle" \
  --assets-dest "$WORK/bundle/assets"

echo "==> Repack + align + sign"
mkdir -p "$WORK/zip/assets"
cp "$WORK/bundle/index.android.bundle" "$WORK/zip/assets/index.android.bundle"
cp "$BASE_APK" "$WORK/app.apk"
( cd "$WORK/zip" && zip -q "$WORK/app.apk" assets/index.android.bundle )

ZIPALIGN="$(ls "$ANDROID_HOME"/build-tools/*/zipalign | sort -V | tail -1)"
"$ZIPALIGN" -f 4 "$WORK/app.apk" "$WORK/aligned.apk"

set -a
# shellcheck disable=SC1091
. credentials/keystore.properties
set +a
APKSIGNER="$(ls "$ANDROID_HOME"/build-tools/*/apksigner | sort -V | tail -1)"
"$APKSIGNER" sign \
  --ks credentials/release.keystore \
  --ks-pass "pass:$storePassword" \
  --key-pass "pass:$keyPassword" \
  --ks-key-alias "$keyAlias" \
  --out "$OUT_APK" "$WORK/aligned.apk"

"$APKSIGNER" verify --print-certs "$OUT_APK" >/dev/null
echo "==> Signed APK: $OUT_APK"

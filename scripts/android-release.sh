#!/usr/bin/env bash
# Builds the Android release APK + AAB with the PRODUCTION API URL baked in.
#
#   scripts/android-release.sh            # apk + aab
#   scripts/android-release.sh apk        # apk only
#   scripts/android-release.sh aab        # aab only
#
# Why a script: `EXPO_PUBLIC_*` values are inlined into the JS bundle at build
# time, and Gradle caches that bundle. Building with the local `.env`
# (localhost:3000) produced an APK that could not reach the server, and a plain
# rebuild reused the cached bundle. This script sets the production URLs and
# forces the bundle task to re-run.
#
# Requires: JDK 17+, Android SDK, and credentials/ (scripts/android-keystore.sh).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-all}"

# Production API/web URL. Override with EXPO_PUBLIC_API_BASE_URL if needed.
API_URL="${EXPO_PUBLIC_API_BASE_URL:-https://app-production-263c.up.railway.app}"
WEB_URL="${EXPO_PUBLIC_WEB_URL:-$API_URL}"

if [ ! -f "$REPO_ROOT/credentials/keystore.properties" ]; then
  echo "ERROR: credentials/keystore.properties missing." >&2
  echo "Run scripts/android-keystore.sh first (or restore your backup)." >&2
  exit 1
fi

if [ ! -d "$REPO_ROOT/android" ]; then
  echo "ERROR: android/ missing. Run: npx expo prebuild --platform android" >&2
  exit 1
fi

echo "Building with:"
echo "  EXPO_PUBLIC_API_BASE_URL=$API_URL"
echo "  EXPO_PUBLIC_WEB_URL=$WEB_URL"
echo

# Force the JS bundle to regenerate so the env values above are actually baked.
rm -f "$REPO_ROOT/android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle"
rm -f "$REPO_ROOT/android/app/build/intermediates/assets/release/mergeReleaseAssets/index.android.bundle"

export EXPO_PUBLIC_API_BASE_URL="$API_URL"
export EXPO_PUBLIC_WEB_URL="$WEB_URL"

GRADLE_TASKS=()
case "$TARGET" in
  apk) GRADLE_TASKS=(assembleRelease) ;;
  aab) GRADLE_TASKS=(bundleRelease) ;;
  all) GRADLE_TASKS=(assembleRelease bundleRelease) ;;
  *) echo "Usage: $0 [apk|aab|all]" >&2; exit 1 ;;
esac

"$REPO_ROOT/android/gradlew" -p "$REPO_ROOT/android" "${GRADLE_TASKS[@]}"

echo
echo "Artifacts:"
[ -f "$REPO_ROOT/android/app/build/outputs/apk/release/app-release.apk" ] && \
  echo "  APK: $REPO_ROOT/android/app/build/outputs/apk/release/app-release.apk"
[ -f "$REPO_ROOT/android/app/build/outputs/bundle/release/app-release.aab" ] && \
  echo "  AAB: $REPO_ROOT/android/app/build/outputs/bundle/release/app-release.aab"

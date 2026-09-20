#!/usr/bin/env bash
# Generates the Android release keystore + credentials.
#
# Run once per machine (or restore a backed-up keystore instead). The keystore
# is the ONLY way to update the app on Play Store — if it is lost the app can
# never be updated under the same package name.
#
#   scripts/android-keystore.sh
#
# Outputs (both gitignored, under android/app/):
#   release.keystore      the signing key
#   keystore.properties   store/key passwords + alias
set -euo pipefail

# Stored OUTSIDE android/ because `expo prebuild --clean` deletes that whole
# directory, which would destroy the keystore.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRED_DIR="$REPO_ROOT/credentials"
KEYSTORE="$CRED_DIR/release.keystore"
PROPS="$CRED_DIR/keystore.properties"
ALIAS="psf-release"

if [ -f "$KEYSTORE" ]; then
  echo "Keystore already exists at $KEYSTORE — refusing to overwrite."
  echo "Delete it first if you really want to regenerate (this breaks Play Store updates)."
  exit 1
fi

mkdir -p "$CRED_DIR"
PW="$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 32)"

keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore "$KEYSTORE" \
  -alias "$ALIAS" \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$PW" -keypass "$PW" \
  -dname "CN=Product Stock Finder, OU=Mobile, O=Product Stock Finder, L=Unknown, ST=Unknown, C=US"

printf 'storePassword=%s\nkeyPassword=%s\nkeyAlias=%s\nstoreFile=../../credentials/release.keystore\n' \
  "$PW" "$PW" "$ALIAS" > "$PROPS"
chmod 600 "$PROPS" "$KEYSTORE"

echo
echo "Wrote:"
echo "  $KEYSTORE"
echo "  $PROPS"
echo
echo "BACK THESE UP NOW. Losing them means you can never update the app on Play Store."
echo "SHA-256 (needed for Android App Links / assetlinks.json):"
keytool -list -v -keystore "$KEYSTORE" -alias "$ALIAS" -storepass "$PW" \
  | grep 'SHA256:' | head -1

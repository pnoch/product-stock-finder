const { withAndroidManifest } = require("@expo/config-plugins");

// Allows cleartext HTTP in release builds.
//
// Dev backends run on http://localhost:3000 (adb reverse) or
// http://10.0.2.2:3000 (emulator). Android 9+ blocks cleartext by default, so
// every fetch silently fails — the app shows "Backend unreachable" with no
// error surfaced anywhere. Production uses HTTPS, so this only relaxes dev.
//
// `android/` is gitignored, so a hand-edit to AndroidManifest.xml is lost on
// the next `expo prebuild --clean`. This plugin re-applies it every prebuild.
const CLEARTEXT_ATTR = "android:usesCleartextTraffic";

function withAndroidCleartextTraffic(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const application = manifest.manifest.application?.[0];
    if (application) {
      application.$[CLEARTEXT_ATTR] = "true";
    }
    return config;
  });
}

module.exports = withAndroidCleartextTraffic;
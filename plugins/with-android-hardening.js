const { withAndroidManifest } = require("@expo/config-plugins");

// Release hardening the libraries don't provide by default. Re-applied on every
// `expo prebuild` because `android/` is gitignored.
//
// - SYSTEM_ALERT_WINDOW ("draw over other apps"): React Native's dev overlay
//   declares it and it leaks into the merged RELEASE manifest, where Play flags
//   it as a sensitive permission. Remove it.
// - READ/WRITE_EXTERNAL_STORAGE: legacy permissions pulled in by
//   expo-file-system. Play wants them scoped to the SDK floor that still uses
//   them, so set `android:maxSdkVersion` (WRITE is a no-op since Android 11).
// - allowBackup: off, so adb/cloud backup cannot extract local data or the
//   keystore-encrypted auth blob from a device.
const REMOVED_PERMISSIONS = ["android.permission.SYSTEM_ALERT_WINDOW"];
const SCOPED_PERMISSIONS = [
  { name: "android.permission.READ_EXTERNAL_STORAGE", maxSdkVersion: "32" },
  { name: "android.permission.WRITE_EXTERNAL_STORAGE", maxSdkVersion: "28" },
];

function withAndroidHardening(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    const application = manifest.application?.[0];
    if (application) {
      application.$["android:allowBackup"] = "false";
    }

    const permissions = manifest["uses-permission"] ?? [];
    const kept = permissions.filter(
      (permission) =>
        !REMOVED_PERMISSIONS.includes(permission.$?.["android:name"]),
    );
    for (const { name, maxSdkVersion } of SCOPED_PERMISSIONS) {
      const existing = kept.find(
        (permission) => permission.$?.["android:name"] === name,
      );
      if (existing) {
        existing.$["android:maxSdkVersion"] = maxSdkVersion;
      } else {
        kept.push({
          $: { "android:name": name, "android:maxSdkVersion": maxSdkVersion },
        });
      }
    }
    manifest["uses-permission"] = kept;

    return config;
  });
}

module.exports = withAndroidHardening;
module.exports.REMOVED_PERMISSIONS = REMOVED_PERMISSIONS;
module.exports.SCOPED_PERMISSIONS = SCOPED_PERMISSIONS;

const { withAndroidManifest, withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// Allows cleartext HTTP ONLY for the local dev backends.
//
// Dev backends run on http://localhost:3000 (adb reverse) or
// http://10.0.2.2:3000 (emulator), and the Metro bundle is served over
// http/ws on the same hosts; Android 9+ blocks cleartext by default, so every
// fetch silently fails — the app shows "Backend unreachable" with no error
// surfaced anywhere.
//
// The previous version set the blanket `android:usesCleartextTraffic="true"`,
// which also permitted cleartext to ANY host in release builds (a MITM risk and
// a Play Store smell). This scopes it with a network-security config: cleartext
// is permitted for loopback / the emulator loopback alias only, and everything
// else stays HTTPS-only. A LAN dev backend (e.g. http://192.168.x.x) is NOT
// covered — use `adb reverse` (localhost) instead.
//
// `android/` is gitignored, so a hand-edit is lost on the next `expo prebuild`;
// this plugin re-applies both the manifest attribute and the resource file every
// prebuild.
const NSC_RELATIVE_PATH = "app/src/main/res/xml/network_security_config.xml";

const NETWORK_SECURITY_CONFIG = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">localhost</domain>
    <domain includeSubdomains="false">127.0.0.1</domain>
    <domain includeSubdomains="false">10.0.2.2</domain>
  </domain-config>
</network-security-config>
`;

function withAndroidCleartextTraffic(config) {
  config = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (application) {
      // Drop the blanket flag if a stale manifest carried it, then point the app
      // at the scoped config.
      delete application.$["android:usesCleartextTraffic"];
      application.$["android:networkSecurityConfig"] =
        "@xml/network_security_config";
    }
    return config;
  });

  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const target = path.join(
        config.modRequest.platformProjectRoot,
        NSC_RELATIVE_PATH,
      );
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await fs.promises.writeFile(target, NETWORK_SECURITY_CONFIG);
      return config;
    },
  ]);

  return config;
}

module.exports = withAndroidCleartextTraffic;
module.exports.NETWORK_SECURITY_CONFIG = NETWORK_SECURITY_CONFIG;
module.exports.NSC_RELATIVE_PATH = NSC_RELATIVE_PATH;

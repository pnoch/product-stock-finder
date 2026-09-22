import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

// Guards the Android cleartext-traffic config plugin. Dev backends run over
// plain HTTP (localhost / 10.0.2.2) and Android 9+ blocks cleartext by default,
// so without this attribute every fetch silently fails in release builds.
// `android/` is gitignored, so the manifest edit must be re-applied by the
// plugin on every `expo prebuild`.
const plugin = require("../plugins/with-android-cleartext-traffic.js");

type ManifestApplication = { $: Record<string, string> };

async function runPlugin(application?: ManifestApplication) {
  const config = plugin({ name: "x", slug: "x" });
  const result = await config.mods.android.manifest({
    modResults: {
      manifest: application ? { application: [application] } : {},
    },
  });
  return result.modResults.manifest as {
    application?: ManifestApplication[];
  };
}

describe("with-android-cleartext-traffic", () => {
  it("sets android:usesCleartextTraffic on the application node", async () => {
    const manifest = await runPlugin({ $: { "android:name": ".MainApplication" } });
    expect(manifest.application?.[0].$["android:usesCleartextTraffic"]).toBe(
      "true",
    );
  });

  it("preserves existing application attributes", async () => {
    const manifest = await runPlugin({
      $: { "android:name": ".MainApplication", "android:allowBackup": "true" },
    });
    expect(manifest.application?.[0].$["android:allowBackup"]).toBe("true");
    expect(manifest.application?.[0].$["android:usesCleartextTraffic"]).toBe(
      "true",
    );
  });

  it("is a no-op when there is no application node", async () => {
    const manifest = await runPlugin();
    expect(manifest.application).toBeUndefined();
  });

  it("is registered in app.config.ts", async () => {
    const src = await readFile("app.config.ts", "utf8");
    expect(src).toContain("./plugins/with-android-cleartext-traffic");
  });
});

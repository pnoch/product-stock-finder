import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Guards the Android cleartext-traffic config plugin. Dev backends run over
// plain HTTP (localhost / 10.0.2.2) and Android 9+ blocks cleartext by default,
// so without a network-security config every fetch silently fails. The config
// must be scoped to the dev hosts — a blanket `usesCleartextTraffic="true"`
// would also permit cleartext to arbitrary hosts in release builds.
// `android/` is gitignored, so the edits must be re-applied on every prebuild.
import cleartextTrafficPlugin from "../plugins/with-android-cleartext-traffic.js";

const plugin = cleartextTrafficPlugin as any;
const NSC_XML: string = plugin.NETWORK_SECURITY_CONFIG;

type ManifestApplication = { $: Record<string, string> };

async function runManifestMod(application?: ManifestApplication) {
  const config = plugin({ name: "x", slug: "x" });
  const result = await config.mods.android.manifest({
    modResults: {
      manifest: application ? { application: [application] } : {},
    },
  });
  return result.modResults.manifest as { application?: ManifestApplication[] };
}

describe("with-android-cleartext-traffic", () => {
  it("points the application at the scoped network-security config", async () => {
    const manifest = await runManifestMod({ $: { "android:name": ".MainApplication" } });
    expect(manifest.application?.[0].$["android:networkSecurityConfig"]).toBe(
      "@xml/network_security_config",
    );
  });

  it("removes a stale blanket usesCleartextTraffic flag", async () => {
    const manifest = await runManifestMod({
      $: { "android:usesCleartextTraffic": "true" },
    });
    expect(manifest.application?.[0].$["android:usesCleartextTraffic"]).toBeUndefined();
  });

  it("preserves existing application attributes", async () => {
    const manifest = await runManifestMod({
      $: { "android:name": ".MainApplication", "android:allowBackup": "true" },
    });
    expect(manifest.application?.[0].$["android:allowBackup"]).toBe("true");
    expect(manifest.application?.[0].$["android:networkSecurityConfig"]).toBe(
      "@xml/network_security_config",
    );
  });

  it("is a no-op when there is no application node", async () => {
    const manifest = await runManifestMod();
    expect(manifest.application).toBeUndefined();
  });

  it("permits cleartext only for the dev loopback hosts", () => {
    expect(NSC_XML).toContain('<base-config cleartextTrafficPermitted="false"');
    const domains = [...NSC_XML.matchAll(/<domain[^>]*>([^<]+)<\/domain>/g)].map(
      (m) => m[1],
    );
    expect(domains.sort()).toEqual(["10.0.2.2", "127.0.0.1", "localhost"]);
  });

  it("writes the network-security config into the Android project", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "psf-nsc-"));
    try {
      const config = plugin({ name: "x", slug: "x" });
      await config.mods.android.dangerous({
        modRequest: { platformProjectRoot: dir },
      });
      const written = await readFile(
        path.join(dir, "app/src/main/res/xml/network_security_config.xml"),
        "utf8",
      );
      expect(written).toContain('<base-config cleartextTrafficPermitted="false" />');
      expect(written).toContain('<domain includeSubdomains="false">10.0.2.2</domain>');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("is registered in app.config.ts", async () => {
    const src = await readFile("app.config.ts", "utf8");
    expect(src).toContain("./plugins/with-android-cleartext-traffic");
  });
});

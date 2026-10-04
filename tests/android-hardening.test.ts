import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

// Guards the Android hardening config plugin (release-only concerns):
// - RN's dev-overlay SYSTEM_ALERT_WINDOW must not leak into release.
// - expo-file-system's legacy storage permissions must be SDK-scoped.
// - adb/cloud backup must be off.
import hardeningPlugin from "../plugins/with-android-hardening.js";

const plugin = hardeningPlugin as any;

type Permission = { $: Record<string, string> };
type Manifest = {
  application?: { $: Record<string, string> }[];
  "uses-permission"?: Permission[];
};

async function runMod(manifest: Manifest) {
  const config = plugin({ name: "x", slug: "x" });
  const result = await config.mods.android.manifest({ modResults: { manifest } });
  return result.modResults.manifest as Manifest;
}

const perm = (name: string): Permission => ({ $: { "android:name": name } });

describe("with-android-hardening", () => {
  it("removes SYSTEM_ALERT_WINDOW and leaves other permissions", async () => {
    const manifest = await runMod({
      application: [{ $: {} }],
      "uses-permission": [
        perm("android.permission.SYSTEM_ALERT_WINDOW"),
        perm("android.permission.POST_NOTIFICATIONS"),
      ],
    });
    const names = manifest["uses-permission"]!.map((p) => p.$["android:name"]);
    expect(names).not.toContain("android.permission.SYSTEM_ALERT_WINDOW");
    expect(names).toContain("android.permission.POST_NOTIFICATIONS");
  });

  it("scopes the legacy storage permissions", async () => {
    const manifest = await runMod({
      application: [{ $: {} }],
      "uses-permission": [
        perm("android.permission.READ_EXTERNAL_STORAGE"),
        perm("android.permission.WRITE_EXTERNAL_STORAGE"),
      ],
    });
    const byName = Object.fromEntries(
      manifest["uses-permission"]!.map((p) => [p.$["android:name"], p.$]),
    );
    expect(byName["android.permission.READ_EXTERNAL_STORAGE"]["android:maxSdkVersion"]).toBe(
      "32",
    );
    expect(byName["android.permission.WRITE_EXTERNAL_STORAGE"]["android:maxSdkVersion"]).toBe(
      "28",
    );
  });

  it("adds a scoped storage permission when the manifest omits it", async () => {
    const manifest = await runMod({ application: [{ $: {} }] });
    const names = manifest["uses-permission"]!.map((p) => p.$["android:name"]);
    expect(names).toContain("android.permission.READ_EXTERNAL_STORAGE");
    expect(names).toContain("android.permission.WRITE_EXTERNAL_STORAGE");
  });

  it("disables backup on the application node", async () => {
    const manifest = await runMod({ application: [{ $: {} }] });
    expect(manifest.application?.[0].$["android:allowBackup"]).toBe("false");
  });

  it("is registered and enables release minify/shrink in app.config.ts", async () => {
    const src = await readFile("app.config.ts", "utf8");
    expect(src).toContain("./plugins/with-android-hardening");
    expect(src).toContain("enableMinifyInReleaseBuilds: true");
    expect(src).toContain("enableShrinkResourcesInReleaseBuilds: true");
  });
});

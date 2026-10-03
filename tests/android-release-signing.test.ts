import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

// Guards the Android release-signing config plugin. `android/` is gitignored,
// so a hand-edit to app/build.gradle is lost on the next `expo prebuild`; the
// plugin must re-apply the release signingConfig every time or release builds
// silently fall back to the debug key, which Play Store rejects.
import releaseSigningPlugin from "../plugins/with-android-release-signing.js";

// The plugin is untyped CommonJS; the config-plugin wrapper's `mods` field is
// not visible in the inferred JS type, so treat the import as opaque.
const plugin = releaseSigningPlugin as any;

// The default block Expo's prebuild emits (no release signingConfig).
const DEFAULT_GRADLE = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.debug
        }
    }
}`;

async function runPlugin(contents: string, language = "groovy") {
  const config = plugin({ name: "x", slug: "x" });
  const result = await config.mods.android.appBuildGradle({
    modResults: { language, contents },
  });
  return result.modResults.contents as string;
}

describe("with-android-release-signing", () => {
  it("adds a release signingConfig and points the release build type at it", async () => {
    const out = await runPlugin(DEFAULT_GRADLE);
    expect(out).toContain("signingConfigs.release");
    expect(out).toContain("credentials/keystore.properties");
    // The release build type must use the release config...
    expect(out).toMatch(/release \{[\s\S]*?signingConfig signingConfigs\.release/);
    // ...and the debug build type must still use the debug config.
    expect(out).toMatch(/debug \{[\s\S]*?signingConfig signingConfigs\.debug/);
  });

  it("does not rewrite the debug build type to the release config", async () => {
    const out = await runPlugin(DEFAULT_GRADLE);
    // A loose regex previously matched the signingConfigs.debug block and
    // rewrote the DEBUG build type, leaving release debug-signed. Slice the
    // buildTypes block specifically (signingConfigs also contains `release {`).
    const buildTypesStart = out.indexOf("buildTypes {");
    const releaseStart = out.indexOf("release {", buildTypesStart);
    const debugBlock = out.slice(buildTypesStart, releaseStart);
    expect(debugBlock).toContain("signingConfig signingConfigs.debug");
    expect(debugBlock).not.toContain("signingConfig signingConfigs.release");
  });

  it("is idempotent when the release config already exists", async () => {
    const once = await runPlugin(DEFAULT_GRADLE);
    const twice = await runPlugin(once);
    expect(twice).toBe(once);
  });

  it("throws on a non-Groovy build file instead of silently no-op'ing", async () => {
    await expect(runPlugin("", "kotlin")).rejects.toThrow(/Groovy/);
  });

  it("is registered in app.config.ts", async () => {
    const src = await readFile("app.config.ts", "utf8");
    expect(src).toContain("./plugins/with-android-release-signing");
  });
});

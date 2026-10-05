import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(__dirname, "..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

describe("native Android modules wiring", () => {
  it("the overlay renderer declares SYSTEM_ALERT_WINDOW and uses an overlay window", () => {
    const manifest = read(
      "modules/psf-webview-renderer/android/src/main/AndroidManifest.xml",
    );
    expect(manifest).toContain("android.permission.SYSTEM_ALERT_WINDOW");
    const renderer = read(
      "modules/psf-webview-renderer/android/src/main/java/expo/modules/psfwebviewrenderer/OverlayRenderer.kt",
    );
    expect(renderer).toContain("TYPE_APPLICATION_OVERLAY");
    // Extraction must happen natively (no RN bridge) so it survives background.
    expect(renderer).toContain("evaluateJavascript");
  });

  it("the foreground service declares the dataSync permission", () => {
    const manifest = read(
      "modules/psf-foreground-service/android/src/main/AndroidManifest.xml",
    );
    expect(manifest).toContain("FOREGROUND_SERVICE_DATA_SYNC");
    expect(manifest).toContain('foregroundServiceType="dataSync"');
  });

  it("the hardening plugin no longer removes SYSTEM_ALERT_WINDOW", () => {
    const plugin = read("plugins/with-android-hardening.js");
    expect(plugin).toContain("const REMOVED_PERMISSIONS = [];");
  });
});

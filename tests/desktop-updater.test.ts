import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(__dirname, "..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");

describe("desktop auto-update wiring", () => {
  it("adds and registers the updater plugin", () => {
    expect(read("desktop/src-tauri/Cargo.toml")).toContain('tauri-plugin-updater = "2"');
    expect(read("desktop/src-tauri/src/lib.rs")).toContain(
      "tauri_plugin_updater::Builder::new().build()",
    );
  });

  it("configures an endpoint, a pubkey and updater artifacts", () => {
    const conf = JSON.parse(read("desktop/src-tauri/tauri.conf.json"));
    expect(conf.bundle.createUpdaterArtifacts).toBe(true);
    expect(Array.isArray(conf.plugins.updater.endpoints)).toBe(true);
    expect(conf.plugins.updater.endpoints.length).toBeGreaterThan(0);
    expect(typeof conf.plugins.updater.pubkey).toBe("string");
  });

  it("grants the updater capability", () => {
    const cap = JSON.parse(read("desktop/src-tauri/capabilities/default.json"));
    expect(cap.permissions).toContain("updater:default");
  });

  it("exposes a check-for-updates control in Settings", () => {
    expect(read("desktop/src/lib/app-updater.ts")).toContain("checkForUpdates");
    const settings = read("desktop/src/pages/Settings.tsx");
    expect(settings).toContain("AppUpdatesRow");
    expect(settings).toContain('aria-label="Check for updates"');
  });
});

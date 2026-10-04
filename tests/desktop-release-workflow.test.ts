import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(__dirname, "..");
const workflow = readFileSync(path.join(root, ".github/workflows/release.yml"), "utf8");
const conf = JSON.parse(
  readFileSync(path.join(root, "desktop/src-tauri/tauri.conf.json"), "utf8"),
);

describe("desktop release workflow", () => {
  it("runs on version tags and can publish a release", () => {
    expect(workflow).toMatch(/tags:\s*\n\s*- "v\*"/);
    expect(workflow).toContain("contents: write");
  });

  it("builds and signs with tauri-action on all desktop platforms", () => {
    expect(workflow).toContain("tauri-apps/tauri-action@");
    expect(workflow).toContain("TAURI_SIGNING_PRIVATE_KEY");
    expect(workflow).toContain("projectPath: desktop");
    expect(workflow).toContain("tauriScript: pnpm tauri");
    expect(workflow).toContain("macos-latest");
    expect(workflow).toContain("ubuntu-22.04");
    expect(workflow).toContain("windows-latest");
  });

  it("publishes the manifest at the endpoint the app checks", () => {
    const endpoint = conf.plugins.updater.endpoints[0] as string;
    expect(endpoint).toBe(
      "https://github.com/pnoch/product-stock-finder/releases/latest/download/latest.json",
    );
    // tauri-action generates and uploads latest.json beside the signed bundles.
    expect(conf.bundle.createUpdaterArtifacts).toBe(true);
  });
});

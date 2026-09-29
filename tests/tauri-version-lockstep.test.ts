import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

async function readJson(path: string): Promise<{ version?: unknown }> {
  return JSON.parse(await readFile(path, "utf8")) as { version?: unknown };
}

describe("version lockstep", () => {
  it("keeps root, desktop, tauri.conf, and Cargo.toml on the same version", async () => {
    const root = await readJson("package.json");
    const desktop = await readJson("desktop/package.json");
    const tauriConf = await readJson("desktop/src-tauri/tauri.conf.json");
    const cargoToml = await readFile("desktop/src-tauri/Cargo.toml", "utf8");
    const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];

    expect(typeof root.version === "string" && root.version.length > 0).toBe(true);
    expect(desktop.version).toBe(root.version);
    expect(tauriConf.version).toBe(root.version);
    expect(cargoVersion).toBe(root.version);
  });

  it("ships every icon the Tauri bundle declares", async () => {
    // A missing bundle icon fails `cargo tauri build` late (or ships a blank
    // icon); nothing else checks that the declared files exist.
    const raw = await readFile("desktop/src-tauri/tauri.conf.json", "utf8");
    const conf = JSON.parse(raw) as { bundle?: { icon?: string[] } };
    const icons = conf.bundle?.icon ?? [];
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      const file = path.resolve("desktop/src-tauri", icon);
      expect(existsSync(file), `missing bundle icon: ${icon}`).toBe(true);
    }
  });
});

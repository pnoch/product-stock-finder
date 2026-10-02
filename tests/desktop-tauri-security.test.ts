import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DESKTOP_SRC = path.join(__dirname, "../desktop/src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("desktop Tauri security posture", () => {
  it("disables the global Tauri API", () => {
    const config = readFileSync(
      path.join(__dirname, "../desktop/src-tauri/tauri.conf.json"),
      "utf8",
    );
    expect(config).toContain('"withGlobalTauri": false');
    expect(config).not.toContain('"withGlobalTauri": true');
  });

  it("never detects Tauri via the injected window.__TAURI__ global", () => {
    const offenders = walk(DESKTOP_SRC).filter((file) =>
      /\.(ts|tsx)$/.test(file) && readFileSync(file, "utf8").includes("__TAURI__"),
    );
    expect(offenders).toEqual([]);
  });

  it("detects Tauri through the shared isTauri() helper", () => {
    const helper = readFileSync(
      path.join(DESKTOP_SRC, "lib/tauri.ts"),
      "utf8",
    );
    expect(helper).toContain('from "@tauri-apps/api/core"');
    expect(helper).toContain("isTauri");
  });
});

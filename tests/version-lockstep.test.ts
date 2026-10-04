import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(__dirname, "..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");
const esc = (v: string) => v.replace(/\./g, "\\.");

// The app version must move in lockstep across every manifest; drift here
// silently ships a mismatched store build / desktop installer (see the
// 5.12.0 → 5.16.0 Tauri drift that had to be fixed by hand).
describe("version lockstep", () => {
  const version = (JSON.parse(read("package.json")) as { version: string }).version;

  it("matches desktop/package.json and the Tauri config", () => {
    expect((JSON.parse(read("desktop/package.json")) as { version: string }).version).toBe(
      version,
    );
    expect(
      (JSON.parse(read("desktop/src-tauri/tauri.conf.json")) as { version: string }).version,
    ).toBe(version);
  });

  it("matches app.config.ts, Cargo.toml and Cargo.lock", () => {
    expect(read("app.config.ts")).toMatch(new RegExp(`version:\\s*"${esc(version)}"`));
    expect(read("desktop/src-tauri/Cargo.toml")).toMatch(
      new RegExp(`^version = "${esc(version)}"`, "m"),
    );
    expect(read("desktop/src-tauri/Cargo.lock")).toMatch(
      new RegExp(`name = "product-stock-finder"\\nversion = "${esc(version)}"`),
    );
  });

  it("is documented in the changelog", () => {
    expect(read("CHANGELOG.md")).toContain(`## [${version}]`);
  });
});

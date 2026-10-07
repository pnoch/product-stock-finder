import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

// impit is a Node-only native module (requires node:fs and a platform .node
// binary). lib/scrapers/plain-fetch.ts imports it lazily, but every bundler
// resolves that import statically, so each one must redirect impit to the stub
// or its build breaks:
//   - Metro (Android/iOS/web export) -> scripts/metro-resolver.js
//   - Vite (desktop)                 -> desktop/vite.config.ts
// This bit twice (Phase 1120 Android, then the desktop build), so pin all of
// them here.
describe("every bundler stubs impit", () => {
  it("Metro redirects impit to the stub on app platforms", () => {
    const src = read("scripts/metro-resolver.js");
    expect(src).toContain("impit-stub.ts");
    expect(src).toContain("resolveImpitPath");
  });

  it("the Metro config wires the impit redirect", () => {
    const src = read("metro.config.js");
    expect(src).toContain("resolveImpitPath");
  });

  it("Vite (desktop) aliases impit to the stub", () => {
    const src = read("desktop/vite.config.ts");
    expect(src).toMatch(/find:\s*\/\^impit\$\//);
    expect(src).toContain("impit-stub.ts");
  });

  it("the stub exists and throws (so plain-fetch falls back to fetch)", () => {
    const src = read("lib/scrapers/impit-stub.ts");
    expect(src).toContain("class Impit");
    expect(src).toContain("throw new Error");
  });
});

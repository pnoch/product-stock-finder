import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

// Guards the CI workflow's coverage. Each of these steps catches a class of
// regression that the others cannot: tsc misses bundler/runtime failures, unit
// tests miss the deployable-artifact builds, and the Rust job is the only place
// the desktop backend is compiled. A silently dropped step is invisible until
// something breaks in production.
describe("CI workflow", () => {
  it("runs the build, test, and smoke steps", async () => {
    const src = await readFile(".github/workflows/ci.yml", "utf8");
    for (const step of [
      "pnpm check",
      "pnpm check:desktop",
      "pnpm lint",
      "pnpm test",
      "pnpm --dir desktop test",
      "pnpm build:desktop",
      "pnpm db:push",
      "pnpm test:db",
      "pnpm build",
      "pnpm smoke:web",
    ]) {
      expect(src, `missing CI step: ${step}`).toContain(step);
    }
  });

  it("compiles and lints the Rust backend", async () => {
    const src = await readFile(".github/workflows/ci.yml", "utf8");
    expect(src).toContain("cargo test");
    expect(src).toContain("cargo fmt --check");
    expect(src).toContain("cargo clippy");
  });

  it("installs the playwright browser before the web smoke test", async () => {
    const src = await readFile(".github/workflows/ci.yml", "utf8");
    const install = src.indexOf("playwright install");
    const smoke = src.indexOf("pnpm smoke:web");
    expect(install).toBeGreaterThan(-1);
    // The browser must be installed before smoke:web or chromium.launch() fails.
    expect(install).toBeLessThan(smoke);
  });
});

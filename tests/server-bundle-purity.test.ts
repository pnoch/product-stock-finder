import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..");

// The production server is bundled with esbuild from server/_core/index.ts and
// run with plain Node. Anything it reaches that imports react-native (or
// AsyncStorage) crashes at startup with a Flow-syntax error — which is exactly
// what happened when lib/scrapers/resilient.ts imported the storage *barrel*
// instead of the leaf module.
describe("server bundle purity", () => {
  it("modules the server imports do not pull the storage barrel", () => {
    // The barrel (lib/storage/index.ts) pulls in AsyncStorage + react-native.
    // Only the modules the server actually reaches matter: breaker-clear.ts
    // imports the barrel too, but it is client-only (Settings), so it cannot
    // drag react-native into the server bundle.
    const serverReachable = [
      "lib/scrapers/resilient.ts",
      "lib/scrapers/health.ts",
      "lib/scrapers/registry.ts",
      "lib/scrapers/utils.ts",
      "lib/currency.ts",
      "lib/deal-score.ts",
      "lib/quiet-hours.ts",
      "lib/concurrency.ts",
    ];
    for (const file of serverReachable) {
      const src = readFileSync(join(ROOT, file), "utf8");
      // A *value* import of the barrel is the problem; `import type` is erased.
      expect(
        /^import\s+(?!type\b)[^;]*from\s+"(\.\.\/)+storage"/m.test(src),
        `${file} must import a leaf storage module, not the barrel`,
      ).toBe(false);
    }
  });

  it("the storage barrel is the only place that imports AsyncStorage", () => {
    // Anything else server-reachable would drag react-native into the bundle.
    const src = readFileSync(join(ROOT, "lib", "scrapers", "resilient.ts"), "utf8");
    expect(src).toContain('from "../storage/adapter"');
    expect(src).not.toMatch(/from\s+"\.\.\/storage"/);
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// `define` is a verbatim text substitution, so `__DEV__` must be a literal.
// Substituting `import.meta.env.DEV` emitted that expression into chunks where
// `import.meta.env` is undefined, and the built desktop app crashed on boot
// with "Cannot read properties of undefined (reading 'DEV')" (empty #root).
describe("desktop vite __DEV__ define", () => {
  it("substitutes a literal, not an import.meta expression", () => {
    const src = readFileSync(join(__dirname, "..", "vite.config.ts"), "utf8");
    const define = src.slice(src.indexOf("define:"), src.indexOf("resolve:"));
    expect(define).toContain("__DEV__: JSON.stringify(");
    expect(define).not.toContain("import.meta.env");
  });
});

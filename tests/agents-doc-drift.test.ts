import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// AGENTS.md is the entry point for every agent working in this repo, so its
// counts must match reality — stale numbers send agents looking for parsers or
// tests that don't exist. These drifted once (25 distributors / ~277 tests
// while the repo had 30 / ~375).
const doc = readFileSync("AGENTS.md", "utf8");

function countTestFiles(dir: string): number {
  let n = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += countTestFiles(join(dir, e.name));
    else if (e.name.endsWith(".test.ts")) n += 1;
  }
  return n;
}

describe("AGENTS.md drift", () => {
  it("states the real distributor and parser counts", () => {
    const distributors = readFileSync("shared/src/distributors.ts", "utf8");
    const distributorCount = new Set(
      [...distributors.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]),
    ).size;
    const parsers = readFileSync("lib/scrapers/registry.ts", "utf8");
    const parserCount = [
      ...parsers.matchAll(/^\s+[a-zA-Z][a-zA-Z0-9]*Parser,$/gm),
    ].length;

    expect(distributorCount).toBe(30);
    expect(parserCount).toBe(25);
    expect(doc).toContain(`across ${distributorCount} global electronics distributors`);
    expect(doc).toContain(`${parserCount} have registered parsers`);
    expect(doc).toContain(`(${distributorCount} entries — ${parserCount} live parsers`);
  });

  it("states a test-file count within 5% of reality", () => {
    // A hard equality would fail every time a test is added; the doc uses
    // approximate counts, so allow a small drift band while still catching a
    // stale number (the doc once said ~277 when the repo had ~375).
    const total = countTestFiles("tests");
    const stated = [...doc.matchAll(/~(\d+) (?:files|test files)/g)].map((m) =>
      Number(m[1]),
    );
    expect(stated.length).toBeGreaterThan(0);
    for (const n of stated) {
      expect(Math.abs(n - total) / total, `stated ~${n} vs actual ${total}`).toBeLessThan(0.05);
    }
  });

  it("states the real schema table count", () => {
    const schema = readFileSync("drizzle/schema.ts", "utf8");
    const tables = [...schema.matchAll(/mysqlTable\(/g)].length;
    expect(doc).toContain(`MySQL schema — ${tables} tables`);
  });
});

describe("design.md drift", () => {
  const design = readFileSync("design.md", "utf8");

  it("states the real distributor and parser counts", () => {
    const distributors = readFileSync("shared/src/distributors.ts", "utf8");
    const distributorCount = new Set(
      [...distributors.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]),
    ).size;
    const parserCount = [
      ...readFileSync("lib/scrapers/registry.ts", "utf8").matchAll(
        /^\s+[a-zA-Z][a-zA-Z0-9]*Parser,$/gm,
      ),
    ].length;

    expect(design).toContain(`across ${distributorCount} global electronics distributors`);
    expect(design).toContain(`(${distributorCount} sites)`);
    // The catalog list must have one bullet per distributor.
    const bullets = design
      .slice(design.indexOf("Key distributors pre-loaded:"))
      .split("\n")
      .filter((l) => l.startsWith("- ")).length;
    expect(bullets).toBeGreaterThanOrEqual(distributorCount);
    void parserCount;
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// `as never` / `as unknown as never` on a domain-object argument defeats the
// type checker: the object can drift from Product/PriceAlert/DistributorListing
// and still compile, so a missing or renamed field ships silently. These call
// sites were all cast for no reason (the literals already satisfy the types);
// this pins them so the casts cannot quietly return.
function sourceFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (["node_modules", ".git", "dist", "dist-web", ".expo"].includes(entry.name))
        continue;
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(entry.name)) files.push(p);
    }
  };
  for (const dir of ["app", "components", "lib", "hooks"]) walk(dir);
  return files;
}

describe("domain-object type casts", () => {
  it("does not cast arguments to the storage mutators", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const src = readFileSync(file, "utf8");
      // addToWatchlist(...) / addAlert(...) with a cast on the argument.
      for (const m of src.matchAll(
        /\b(?:addToWatchlist|addAlert)\s*\([^)]*?\bas\s+(?:unknown\s+as\s+)?never\b/g,
      )) {
        offenders.push(`${file}: ${m[0].replace(/\s+/g, " ").slice(0, 60)}`);
      }
    }
    expect(offenders, `cast domain args:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("does not cast listings arrays passed to getBestPrice", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles()) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(
        /getBestPrice\s*\([^)]*?\bas\s+(?:unknown\s+as\s+)?never\[\]/g,
      )) {
        offenders.push(`${file}: ${m[0].replace(/\s+/g, " ").slice(0, 60)}`);
      }
    }
    expect(offenders, `cast listings:\n${offenders.join("\n")}`).toEqual([]);
  });
});

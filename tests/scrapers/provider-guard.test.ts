import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("scraping provider is server-only", () => {
  it("only server/scrapers/provider.ts reads SCRAPING_PROVIDER_*", () => {
    const root = path.resolve(__dirname, "../..");
    const offenders: string[] = [];
    for (const dir of ["lib", "app", "components", "hooks", "shared", "server"]) {
      for (const file of walk(path.join(root, dir))) {
        const rel = path.relative(root, file);
        if (rel === "server/scrapers/provider.ts") continue;
        if (/SCRAPING_PROVIDER_/.test(readFileSync(file, "utf-8"))) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});

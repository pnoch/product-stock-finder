import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

describe("impit is server-only", () => {
  it("is imported only in lib/scrapers/plain-fetch.ts", () => {
    const root = path.resolve(__dirname, "../..");
    const offenders: string[] = [];
    for (const dir of ["lib", "app", "components", "hooks", "shared"]) {
      for (const file of walk(path.join(root, dir))) {
        const rel = path.relative(root, file);
        // plain-fetch.ts is the one real impit importer; impit-stub.ts is the
        // Metro redirect target (it does not import impit — it replaces it).
        if (rel === "lib/scrapers/plain-fetch.ts" || rel === "lib/scrapers/impit-stub.ts") {
          continue;
        }
        const src = readFileSync(file, "utf-8");
        if (/from\s+["']impit["']/.test(src) || /import\(\s*["']impit["']\s*\)/.test(src)) {
          offenders.push(rel);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

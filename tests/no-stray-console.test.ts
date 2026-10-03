import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Client logging must route through @shared/log so that debug/info can be
// silenced in production and a monitoring sink can be attached. Raw console.*
// calls bypass both.
const ROOTS = ["lib", "app", "components", "hooks"];
const WHITELIST = new Set([path.join("shared", "src", "log.ts")]);

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["node_modules", ".expo", "dist", "_core"].includes(entry.name)) {
        out.push(...(await walk(p)));
      }
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")) {
      out.push(p);
    }
  }
  return out;
}

describe("no stray console", () => {
  it("client app code logs through @shared/log", async () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of await walk(root)) {
        if (WHITELIST.has(file)) continue;
        const src = await readFile(file, "utf8");
        if (/\bconsole\./.test(src)) offenders.push(file);
      }
    }
    expect(offenders, `raw console.* in ${offenders.join(", ")}`).toEqual([]);
  });
});

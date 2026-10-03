import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Client logging must route through @shared/log so that debug/info can be
// silenced in production and a monitoring sink can be attached. Raw console.*
// calls bypass both.
// Scope: mobile/web client app code and the desktop renderer.
const ROOTS = ["lib", "app", "components", "hooks", "desktop/src"];

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

describe("no stray console (mobile/web client app code and desktop renderer)", () => {
  it("client app code and desktop renderer log through @shared/log", async () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of await walk(root)) {
        const src = await readFile(file, "utf8");
        if (/\bconsole\./.test(src)) offenders.push(file);
      }
    }
    expect(offenders, `raw console.* in ${offenders.join(", ")}`).toEqual([]);
  });
});

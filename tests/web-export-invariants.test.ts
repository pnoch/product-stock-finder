import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

// Guards the class of bug that shipped a blank web app: `import.meta` in a
// classic script. The built-artifact checks live in scripts/smoke-web.mjs,
// which CI runs AFTER `pnpm build`; these are source-level invariants that hold
// regardless of build order (CI runs `pnpm test` before `pnpm build`).

async function sourceFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      out.push(...(await sourceFiles(full)));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("web export source invariants", () => {
  it("no app source uses import.meta (invalid in a classic script)", async () => {
    const dirs = ["app", "components", "lib", "hooks", "constants", "shared"];
    const offenders: string[] = [];
    for (const dir of dirs) {
      for (const file of await sourceFiles(dir)) {
        const src = await readFile(file, "utf8");
        // Strip comments so a mention in prose doesn't trip the guard.
        const code = src
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/(^|[^:])\/\/.*$/gm, "$1");
        if (/\bimport\.meta\b/.test(code)) offenders.push(file);
      }
    }
    expect(offenders, "import.meta breaks the classic-script web bundle").toEqual(
      [],
    );
  });

  it("sw.js precache list has no hashed bundles", async () => {
    const sw = await readFile("public/sw.js", "utf8");
    const block = sw.match(/PRECACHE_URLS\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? "";
    expect(block).not.toContain("_expo");
    expect(block).not.toMatch(/[a-f0-9]{16,}/);
  });
});

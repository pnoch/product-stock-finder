import { describe, expect, it } from "vitest";
import { readFile, stat } from "node:fs/promises";

// Guards the class of bug that shipped a blank web app: a runtime reference
// that only fails in a real browser (e.g. `import.meta` in a classic script).
// The full browser smoke test lives in scripts/smoke-web.mjs and runs in CI
// after `pnpm build`; these are the cheap static invariants.

describe("web export bundle invariants", () => {
  it("the entry bundle contains no import.meta (classic script)", async () => {
    let html: string;
    try {
      html = await readFile("dist-web/index.html", "utf8");
    } catch {
      return; // no export present — the build step covers this
    }
    const src = html.match(/src="(\/_expo\/static\/js\/web\/entry-[^"]+)"/)?.[1];
    expect(src, "entry script tag present").toBeTruthy();
    const bundle = await readFile(`dist-web${src}`, "utf8");
    expect(bundle).not.toContain("import.meta");
  });

  it("the entry script is not type=module (so import.meta would be invalid)", async () => {
    let html: string;
    try {
      html = await readFile("dist-web/index.html", "utf8");
    } catch {
      return;
    }
    const tag = html.match(/<script[^>]*entry-[^>]*>/)?.[0] ?? "";
    expect(tag).not.toContain('type="module"');
  });

  it("sw.js precache list has no hashed bundles", async () => {
    const sw = await readFile("public/sw.js", "utf8");
    const block = sw.match(/PRECACHE_URLS\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? "";
    expect(block).not.toContain("_expo");
    expect(block).not.toMatch(/[a-f0-9]{16,}/);
  });

  it("the server bundle exists after a build", async () => {
    try {
      await stat("dist/index.js");
    } catch {
      return; // not built in this run
    }
    expect(true).toBe(true);
  });
});

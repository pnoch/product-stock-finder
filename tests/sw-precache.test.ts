import { describe, expect, it } from "vitest";
import { readFile, stat } from "node:fs/promises";

const STABLE_GENERATED = new Set(["/index.html", "/favicon.ico"]);

async function readPrecacheUrls(): Promise<string[]> {
  const source = await readFile("public/sw.js", "utf8");
  const block = source.match(/PRECACHE_URLS\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? "";
  return [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

describe("public/sw.js precache list", () => {
  it("contains only stable URLs (no hashed /_expo/static/* bundles)", async () => {
    const urls = await readPrecacheUrls();
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).not.toContain("_expo");
      expect(url).not.toMatch(/[a-f0-9]{16,}/);
    }
  });

  it("refreshes the offline shell under /index.html on a navigation", async () => {
    const source = await readFile("public/sw.js", "utf8");
    const navigateStart = source.indexOf('mode === "navigate"');
    expect(navigateStart).toBeGreaterThan(-1);
    // Bound the branch by the next handler so the assertion can see the whole
    // cache.put call (slicing at the call itself excluded it).
    const block = source.slice(
      navigateStart,
      source.indexOf("/_expo/static/", navigateStart),
    );
    // The fallback reads /index.html; storing the navigation under its own URL
    // grew the cache and left the shell stale after a deploy.
    expect(block).toContain('cache.put("/index.html", clone)');
  });

  it("every precached URL resolves to a real file", async () => {
    const urls = await readPrecacheUrls();
    for (const url of urls) {
      if (STABLE_GENERATED.has(url)) continue;
      const local = `public${url}`;
      await expect(stat(local), `${url} should exist as ${local}`).resolves.toBeDefined();
    }
  });
});

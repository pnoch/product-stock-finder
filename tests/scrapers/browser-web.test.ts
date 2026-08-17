import { describe, it, expect } from "vitest";
import { readdir, readFile, stat } from "fs/promises";
import path from "path";

const SCRAPERS_DIR = path.resolve(__dirname, "../../lib/scrapers");

async function listTsFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir)) {
    const full = path.join(dir, entry);
    const info = await stat(full);
    if (info.isDirectory()) {
      out.push(...(await listTsFiles(full)));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("browser web stub", () => {
  it("exports the same surface as the node browser module", async () => {
    const real = await import("@/lib/scrapers/browser");
    const stub = await import("@/lib/scrapers/browser.web");
    const realKeys = Object.keys(real).sort();
    const stubKeys = Object.keys(stub).sort();
    for (const key of realKeys) {
      expect(stubKeys, `stub missing export ${key}`).toContain(key);
    }
  });

  it("throws BrowserUnavailableError when used", async () => {
    const { fetchWithBrowser } = await import("@/lib/scrapers/browser.web");
    await expect(fetchWithBrowser("https://example.com")).rejects.toThrow(
      "browser escalation unavailable on web",
    );
  });
});

describe("playwright web-bundle guard", () => {
  it("only browser.ts statically imports playwright", async () => {
    const roots = [
      path.resolve(__dirname, "../../lib"),
      path.resolve(__dirname, "../../app"),
      path.resolve(__dirname, "../../components"),
      path.resolve(__dirname, "../../hooks"),
      path.resolve(__dirname, "../../shared"),
    ];
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of await listTsFiles(root)) {
        const rel = path.relative(
          path.resolve(__dirname, "../.."),
          file,
        );
        if (rel === "lib/scrapers/browser.ts") continue;
        const src = await readFile(file, "utf-8");
        if (
          /\bfrom\s+["']playwright["']/.test(src) ||
          /\brequire\(\s*["']playwright["']\s*\)/.test(src)
        ) {
          offenders.push(rel);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the web stub variant exists for Metro to resolve on web", async () => {
    const files = await readdir(SCRAPERS_DIR);
    expect(files).toContain("browser.web.ts");
  });
});

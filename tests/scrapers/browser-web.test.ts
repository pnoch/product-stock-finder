import { describe, it, expect, vi } from "vitest";
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
      "browser escalation unavailable on this platform",
    );
  });

  it("rejects every browserPool operation", async () => {
    const { browserPool } = await import("@/lib/scrapers/browser.web");
    const { BrowserUnavailableError } = await import(
      "@/lib/scrapers/resilient"
    );
    await expect(browserPool.acquire()).rejects.toBeInstanceOf(
      BrowserUnavailableError,
    );
    await expect(browserPool.shutdown()).rejects.toBeInstanceOf(
      BrowserUnavailableError,
    );
    // release is synchronous: an escalation that somehow reached it must fail
    // loudly rather than silently proceeding without a browser.
    expect(() => browserPool.release({})).toThrow(BrowserUnavailableError);
  });

  it("teardown closes the page and context, then releases", async () => {
    const { teardownBrowserSession } = await import(
      "@/lib/scrapers/browser.web"
    );
    const page = { close: vi.fn(async () => {}) };
    const context = { close: vi.fn(async () => {}) };
    const release = vi.fn();
    await teardownBrowserSession(page, context, release);
    expect(page.close).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("teardown still releases when close throws or handles are absent", async () => {
    const { teardownBrowserSession } = await import(
      "@/lib/scrapers/browser.web"
    );
    const page = {
      close: vi.fn(async () => {
        throw new Error("already closed");
      }),
    };
    const context = {
      close: vi.fn(async () => {
        throw new Error("already closed");
      }),
    };
    const release = vi.fn();
    await expect(
      teardownBrowserSession(page, context, release),
    ).resolves.toBeUndefined();
    expect(release).toHaveBeenCalledTimes(1);

    const release2 = vi.fn();
    await teardownBrowserSession(undefined, undefined, release2);
    expect(release2).toHaveBeenCalledTimes(1);
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

describe("native browser module", () => {
  it("browser-native.ts has the same surface as browser.ts", async () => {
    const real = await import("@/lib/scrapers/browser");
    const native = await import("@/lib/scrapers/browser-native");
    for (const key of Object.keys(real)) {
      expect(Object.keys(native), `native missing ${key}`).toContain(key);
    }
  });

  it("only the webview host component references react-native-webview", async () => {
    const roots = [
      path.resolve(__dirname, "../../lib"),
      path.resolve(__dirname, "../../app"),
      path.resolve(__dirname, "../../components"),
    ];
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of await listTsFiles(root)) {
        const rel = path.relative(path.resolve(__dirname, "../.."), file);
        if (rel === "components/webview-fetch-host.tsx") continue;
        const src = await readFile(file, "utf-8");
        if (/from\s+["']react-native-webview["']/.test(src)) offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });
});

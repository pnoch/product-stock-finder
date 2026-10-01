import { describe, expect, it, vi, beforeEach } from "vitest";
import { readdirSync } from "node:fs";
import path from "node:path";

// Every scraper module imports `fetchWithRateLimit` from ./utils; mock that one
// binding while keeping the real parsing helpers.
const fetchWithRateLimit = vi.hoisted(() => vi.fn());
const fetchWithParser = vi.hoisted(() => vi.fn());
vi.mock("../../lib/scrapers/utils", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../lib/scrapers/utils")>();
  return { ...actual, fetchWithRateLimit, fetchWithParser };
});

const SCRAPERS_DIR = path.join(__dirname, "../../lib/scrapers");
const SKIP = new Set([
  "utils",
  "resilient",
  "browser",
  "browser.web",
  "registry",
  "types",
  "health",
  "breaker-clear",
  "breaker-store",
]);

function moduleFiles(): string[] {
  return readdirSync(SCRAPERS_DIR)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => f.replace(/\.ts$/, ""))
    .filter((name) => !SKIP.has(name));
}

describe("scraper network wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const files = moduleFiles();
  expect(files.length).toBeGreaterThan(0);

  for (const name of files) {
    it(`${name}: fetches via the rate-limited util and swallows failures`, async () => {
      const mod = (await import(
        /* @vite-ignore */ `../../lib/scrapers/${name}`
      )) as Record<string, unknown>;

      const scrapeEntry = Object.entries(mod).find(
        ([key, value]) =>
          key.startsWith("scrape") && typeof value === "function",
      );
      if (!scrapeEntry) return;
      const scrape = scrapeEntry[1] as (model: string) => Promise<unknown>;

      const parser = Object.values(mod).find(
        (v): v is {
          buildSearchUrl: (m: string) => string;
          rateLimitMs: number;
        } =>
          typeof v === "object" &&
          v !== null &&
          typeof (v as { buildSearchUrl?: unknown }).buildSearchUrl ===
            "function" &&
          typeof (v as { id?: unknown }).id === "string",
      );
      expect(parser).toBeDefined();

      // Wrappers use one of two helpers; both must be mocked so no real network
      // call happens. Whichever the module uses, assert it got the parser URL.
      const rateLimitMock = fetchWithRateLimit;
      const parserMock = fetchWithParser;
      const html = "<html><body>none</body></html>";
      rateLimitMock.mockResolvedValueOnce(html);
      parserMock.mockResolvedValueOnce(html);

      await scrape("CRS804");

      const usedRateLimit = rateLimitMock.mock.calls.length;
      const usedParser = parserMock.mock.calls.length;
      expect(usedRateLimit + usedParser).toBe(1);
      if (usedRateLimit) {
        const [url, rateLimit] = rateLimitMock.mock.calls[0]!;
        expect(url).toBe(parser!.buildSearchUrl("CRS804"));
        expect(rateLimit).toBe(parser!.rateLimitMs);
      } else {
        const [parserArg, url] = parserMock.mock.calls[0]!;
        expect(parserArg).toBe(parser);
        expect(url).toBe(parser!.buildSearchUrl("CRS804"));
      }

      // Failure path: a rejected fetch is swallowed to null (never throws).
      rateLimitMock.mockRejectedValueOnce(new Error("network down"));
      parserMock.mockRejectedValueOnce(new Error("network down"));
      await expect(scrape("CRS804")).resolves.toBeNull();
    });
  }
});

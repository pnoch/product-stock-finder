import { StockStatus } from "../types";
import { DistributorParser } from "./types";

export const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
];

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export function inferStockStatus(text: string): StockStatus {
  const lower = text.toLowerCase();
  // Negative markers must win over substring matches like "available" in
  // "unavailable" or weak signals like "Backorder available".
  if (
    lower.includes("out of stock") ||
    lower.includes("unavailable") ||
    lower.includes("not available") ||
    lower.includes("sold out")
  ) {
    return "out_of_stock";
  }
  if (
    lower.includes("back order") ||
    lower.includes("backorder") ||
    lower.includes("pre-order") ||
    lower.includes("expected")
  ) {
    return "back_order";
  }
  if (
    lower.includes("in stock") ||
    lower.includes("available") ||
    lower.includes("add to cart")
  ) {
    return "in_stock";
  }
  return "unknown";
}

export async function fetchWithRateLimit(
  url: string,
  rateLimitMs: number,
): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, rateLimitMs));
  const response = await fetch(url, {
    headers: {
      "User-Agent": getRandomUserAgent(),
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.text();
}

export function parsePriceFromText(text: string): number | null {
  // Capture digit runs including space/NBSP grouping and both separator
  // styles so "€ 1.234,56" / "R 12 345.67" survive intact.
  const match = text.match(/\d(?:[\d,. \u00a0\u202f]*\d)?/);
  if (!match) return null;
  const raw = match[0].replace(/[\s\u00a0\u202f]/g, "");
  const lastDot = raw.lastIndexOf(".");
  const lastComma = raw.lastIndexOf(",");
  let normalized: string;
  if (lastComma > lastDot && !/^\d{1,3}(,\d{3})+$/.test(raw)) {
    // Comma is the decimal separator (e.g. "1.234,56", "12,5"); the
    // groups-of-three exception keeps US thousands like "12,345" intact.
    normalized = raw.replace(/\./g, "").replace(/,/g, ".");
  } else {
    normalized = raw.replace(/,/g, "");
  }
  const num = parseFloat(normalized);
  return isNaN(num) || num === 0 ? null : num;
}

export async function fetchWithParser(
  parser: DistributorParser,
  url: string,
): Promise<string> {
  if (parser.useBrowser) {
    try {
      const { fetchWithBrowser } = await import("./browser");
      return await fetchWithBrowser(url, parser.browserOptions);
    } catch {
      // Playwright unavailable (e.g. mobile) — fall back to plain HTTP
    }
  }
  return fetchWithRateLimit(url, parser.rateLimitMs);
}

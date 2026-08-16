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
  if (
    lower.includes("in stock") ||
    lower.includes("available") ||
    lower.includes("add to cart")
  ) {
    return "in_stock";
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
    lower.includes("out of stock") ||
    lower.includes("unavailable") ||
    lower.includes("sold out")
  ) {
    return "out_of_stock";
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
  const match = text.match(/\d[\d,]*\.?\d*/);
  if (!match) return null;
  const cleaned = match[0].replace(/,/g, "");
  const num = parseFloat(cleaned);
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

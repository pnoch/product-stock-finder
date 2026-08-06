import { StockStatus } from "@/lib/types";
import { DistributorParser } from "./types";

const USER_AGENTS = [
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
  if (lower.includes("in stock") || lower.includes("available") || lower.includes("add to cart")) {
    return "in_stock";
  }
  if (lower.includes("back order") || lower.includes("backorder") || lower.includes("pre-order") || lower.includes("expected")) {
    return "back_order";
  }
  if (lower.includes("out of stock") || lower.includes("unavailable") || lower.includes("sold out")) {
    return "out_of_stock";
  }
  return "unknown";
}

export function extractCurrency(text: string): string | null {
  const symbols: Record<string, string> = {
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
    "R": "ZAR",
    "A$": "AUD",
    "NZ$": "NZD",
    "C$": "CAD",
    "RM": "MYR",
    "د.إ": "AED",
    "S$": "SGD",
    "HK$": "HKD",
    "฿": "THB",
  };
  for (const [symbol, code] of Object.entries(symbols)) {
    if (text.includes(symbol)) return code;
  }
  return null;
}

export async function fetchWithRateLimit(
  url: string,
  rateLimitMs: number
): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, rateLimitMs));
  const response = await fetch(url, {
    headers: {
      "User-Agent": getRandomUserAgent(),
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
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

export function extractExpectedDate(text: string): string | undefined {
  const patterns = [
    /(?:expected|available|back in stock)[:\s]*([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i,
    /(\d{1,2}\s+[A-Za-z]+\s+\d{4})/,
    /([A-Za-z]+\s+\d{1,2},?\s*\d{4})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return undefined;
}

export async function fetchWithParser(
  parser: DistributorParser,
  url: string,
): Promise<string> {
  if (parser.useBrowser) {
    const { fetchWithBrowser } = await import("@/lib/scrapers/browser");
    return fetchWithBrowser(url, parser.browserOptions);
  }
  return fetchWithRateLimit(url, parser.rateLimitMs);
}

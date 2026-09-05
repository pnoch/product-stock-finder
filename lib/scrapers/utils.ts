import { StockStatus } from "../types";
import { DistributorParser } from "./types";
import type { Cheerio } from "cheerio";
import type { Element } from "domhandler";

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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const COMMERCE_SUFFIXES = new Set([
  "rm",
  "in",
  "us",
  "eu",
  "uk",
  "au",
  "nz",
  "za",
  "my",
  "ca",
  "ch",
  "sg",
  "jp",
]);

export function matchesModel(text: string, model: string): boolean {
  const needle = model.trim();
  if (!needle || !text) return false;
  let pattern = "";
  for (let i = 0; i < needle.length; i++) {
    const ch = needle[i]!;
    if (/[a-z0-9]/i.test(ch)) {
      pattern += escapeRegExp(ch);
    } else {
      // A trailing separator in the model is required in the text — otherwise
      // the lazy class matches empty and "…2S+XTX" masquerades as "…2S".
      const isLast = i === needle.length - 1;
      pattern += isLast ? "[^a-z0-9]+?" : "[^a-z0-9]*?";
    }
  }
  let re: RegExp;
  try {
    re = new RegExp(pattern, "gi");
  } catch {
    return false;
  }
  const lastChar = needle[needle.length - 1]!;
  for (const match of text.matchAll(re)) {
    const start = match.index;
    const end = start + match[0].length;
    const before = start > 0 ? text[start - 1]! : "";
    const after = end < text.length ? text[end]! : "";
    if (!/[a-z0-9]/i.test(before) && !/[a-z0-9]/i.test(after)) return true;
    // Tolerate known SKU suffixes (e.g. "+RM", "-IN") only when the model
    // itself ends with a separator; mid-token extensions stay rejected.
    if (
      !/[a-z0-9]/i.test(before) &&
      !/[a-z0-9]/i.test(lastChar) &&
      /[a-z0-9]/i.test(after)
    ) {
      const tail = text.slice(end).match(/^[a-z0-9]+/i)?.[0] ?? "";
      if (/^[a-z]{2,3}$/i.test(tail) && COMMERCE_SUFFIXES.has(tail.toLowerCase()))
        return true;
    }
  }
  return false;
}

export function productRowContext(
  $el: Cheerio<Element>,
): { text: string; href: string } {
  const row = $el
    .closest(
      "tr, article, .product, .product-item, .productitem, .product-item-details, .product-item-info, .item, .product-card, li",
    )
    .first();
  const container = row.length ? row : $el;
  const href = container.find("a[href]").first().attr("href") ?? "";
  return { text: container.text(), href };
}

export function modelMismatch(
  $el: Cheerio<Element>,
  model?: string,
): boolean {
  if (!model) return false;
  let node: Cheerio<Element> | null = $el;
  let sawContent = false;
  for (let depth = 0; depth < 4 && node && node.length > 0; depth++) {
    const { text, href } = productRowContext(node);
    if (text.trim() || href) {
      sawContent = true;
      if (matchesModel(text, model) || matchesModel(href, model)) return false;
    }
    const parent: Cheerio<Element> = node.parent();
    node = parent.length > 0 ? parent : null;
  }
  return sawContent;
}

function matchDepth(
  $el: Cheerio<Element>,
  model: string,
): number {
  let node: Cheerio<Element> | null = $el;
  for (let depth = 0; depth < 4 && node && node.length > 0; depth++) {
    const { text, href } = productRowContext(node);
    if (text.trim() || href) {
      if (matchesModel(text, model) || matchesModel(href, model)) return depth;
    }
    const parent: Cheerio<Element> = node.parent();
    node = parent.length > 0 ? parent : null;
  }
  return Infinity;
}

/**
 * Selects the price element whose card context matches the model, preferring
 * the shortest walk-up distance over document order. Without a model this is
 * identical to `.first()`. Returns null when nothing matches anything.
 *
 * This fixes the wrong-product bug where `.first()` grabbed another card's
 * price and the shared container text satisfied the model check.
 */
export function findPriceElement(
  $: (selector: string | Element) => Cheerio<Element>,
  selector: string,
  model?: string,
): Cheerio<Element> | null {
  const $prices = $(selector);
  if ($prices.length === 0) return null;
  if (!model) return $prices.first();
  let best: Cheerio<Element> | null = null;
  let bestDepth = Infinity;
  $prices.each((index, _el) => {
    const depth = matchDepth($prices.eq(index), model);
    if (depth < bestDepth) {
      bestDepth = depth;
      best = $prices.eq(index);
    }
  });
  return bestDepth === Infinity ? null : best;
}

import { StockStatus } from "../types";
import { DistributorParser } from "./types";
import {
  backgroundSafeDelay,
  getBackgroundAppState,
} from "../background-safe-timers";
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
  // "unavailable" or "in stock" in "not in stock".
  if (
    lower.includes("out of stock") ||
    lower.includes("not in stock") ||
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
    // Stores spell it without the hyphen too; missing it classified a preorder
    // as in_stock (a false in-stock / restock signal).
    lower.includes("preorder") ||
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
  // Android backgrounded: every setTimeout freezes and politeness is moot
  // inside the short background budget — skip the delay entirely there.
  if (getBackgroundAppState() === "background") {
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
  await backgroundSafeDelay(rateLimitMs);
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
  } else if (
    lastComma === -1 &&
    /^\d{1,3}(\.\d{3})+$/.test(raw)
  ) {
    // Dot-only groups of three ("1.299", "1.234.567") are thousands separators,
    // not decimals — European distributors render whole-euro prices this way,
    // and a currency price with 3+ decimals is implausible.
    normalized = raw.replace(/\./g, "");
  } else {
    normalized = raw.replace(/,/g, "");
  }
  // `Number` (not `parseFloat`) so a malformed separator run ("1.2.3",
  // "1,23,456") is rejected outright: parseFloat silently truncated it to a
  // plausible-looking but wrong price, while the desktop parser fails closed.
  const num = Number(normalized);
  // Reject non-finite (a long digit run overflows to Infinity) as well as
  // zero, which is never a valid price.
  return !Number.isFinite(num) || num === 0 ? null : num;
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
    // Card text is often whitespace-less ("MikroTikCRS326-24G-2S+IN"), so a
    // preceding LETTER is a brand concatenation and must be allowed. A
    // preceding DIGIT means the model is embedded in a longer number
    // ("4032CRS804"), which must stay rejected. The trailing boundary still
    // prevents "CRS326" matching inside "CRS3260".
    const beforeOk = !/[a-z0-9]/i.test(before) || /[a-z]/i.test(before);
    if (beforeOk && !/[a-z0-9]/i.test(after)) return true;
    // Tolerate known SKU suffixes (e.g. "+RM", "-IN") only when the model
    // itself ends with a separator; mid-token extensions stay rejected.
    if (beforeOk && !/[a-z0-9]/i.test(lastChar) && /[a-z0-9]/i.test(after)) {
      const tail = text.slice(end).match(/^[a-z0-9]+/i)?.[0] ?? "";
      if (/^[a-z]{2,3}$/i.test(tail) && COMMERCE_SUFFIXES.has(tail.toLowerCase()))
        return true;
    }
  }
  return false;
}

// Specific product-card containers. Preferred over the generic row selectors
// below, because a single <tr>/<li> can wrap SEVERAL product cards (Aerial puts
// its whole results grid in one <tr>), in which case the row's text contains
// every model and would validate any price inside it.
// The bare `.item` alternative was removed: it is a generic list/grid wrapper on
// many shops, so `closest` returned the wrapper (nearest ancestor matching any
// alternative) instead of the per-product card. Because the wrapper's text
// names every product in the list, `modelMismatch` then validated a decoy
// price. Losing a parser that only marks its cards `.item` now yields a miss
// rather than a wrong-product price, which is the intended trade-off.
const CARD_SELECTORS =
  "article, .product, .product-item, .productitem, .product-item-details, .product-item-info, .product-card, .aerial-card, .ac-item";
// Generic row containers, used only when no specific card is found (e.g. a
// table where each product is its own <tr>).
const ROW_SELECTORS = "tr, li";

function closestContainer(
  $el: Cheerio<Element>,
  selectors: string,
): Cheerio<Element> {
  return $el.closest(selectors).first() as unknown as Cheerio<Element>;
}

export function productRowContext(
  $el: Cheerio<Element>,
): { text: string; href: string } {
  const card = closestContainer($el, CARD_SELECTORS);
  const row = card.length > 0 ? card : closestContainer($el, ROW_SELECTORS);
  const container = row.length ? row : $el;
  const href = container.find("a[href]").first().attr("href") ?? "";
  return { text: container.text(), href };
}

export function modelMismatch(
  $el: Cheerio<Element>,
  model?: string,
): boolean {
  if (!model) return false;
  // Prefer the product card boundary. Walking above the card reaches page-level
  // containers (a search-results header naming the model, the <body>), whose
  // text would satisfy the model check for *any* price on the page — letting a
  // decoy price through. If a card exists, the verdict must come from it alone.
  const card = closestContainer($el, CARD_SELECTORS);
  const row = card.length > 0 ? card : closestContainer($el, ROW_SELECTORS);
  if (row.length > 0) {
    const { text, href } = productRowContext($el);
    if (text.trim() || href) {
      return !(matchesModel(text, model) || matchesModel(href, model));
    }
  }
  let node: Cheerio<Element> | null = $el;
  let sawContent = false;
  // Walk up to the product container, but never past page-level structure:
  // `body`/`html` text includes headers ("Search results for <model>") that
  // would validate any price on the page. A product page's own container
  // (e.g. `.product-detail`) is reached well before `body`, so its heading
  // still counts.
  for (let depth = 0; depth < 4 && node && node.length > 0; depth++) {
    const tag = (node.get(0) as Element | undefined)?.tagName?.toLowerCase();
    if (tag === "body" || tag === "html") break;
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

// True when an element's first digit run comes from the model token itself,
// e.g. a cell holding "CRS804-4DDQ-hRM $480.00". parsePriceFromText reads that
// first run ("804"), so such a candidate is only used when nothing else matches.
function priceComesFromModel(text: string, model: string): boolean {
  const m = text.match(/\d(?:[\d,. \u00a0\u202f]*\d)?/);
  if (!m) return false;
  const digits = m[0].replace(/\D/g, "");
  if (digits.length < 2) return false;
  const modelDigits = model.replace(/\D/g, "");
  return modelDigits.length > 0 && modelDigits.includes(digits);
}

function matchDepth(
  $el: Cheerio<Element>,
  model: string,
  memo: Map<string, boolean>,
): number {
  // A page has few distinct card contexts but many price elements, and every
  // candidate re-checks its context at each walk-up depth. `matchesModel` is
  // regex-heavy, so cache its verdict per input string for the whole call
  // (e.g. Flytec's mismatch path drops from ~4.2s to ~0.2s).
  const cachedMatch = (input: string): boolean => {
    const cached = memo.get(input);
    if (cached !== undefined) return cached;
    const value = matchesModel(input, model);
    memo.set(input, value);
    return value;
  };
  let node: Cheerio<Element> | null = $el;
  for (let depth = 0; depth < 4 && node && node.length > 0; depth++) {
    const { text, href } = productRowContext(node);
    if (text.trim() || href) {
      if (cachedMatch(text) || cachedMatch(href)) return depth;
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
  // Try each selector in the list IN ORDER and return the best match from the
  // first selector that matches anything. Selector order is the caller's
  // priority (e.g. ".actual-price, .price" must prefer the actual price);
  // merging them into one query would fall back to document order and pick the
  // strikethrough/compare-at price that happens to come first.
  const selectors = selector
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const matchMemo = new Map<string, boolean>();
  for (const single of selectors) {
    const $prices = $(single);
    if ($prices.length === 0) continue;
    if (!model) return $prices.first();
    let best: Cheerio<Element> | null = null;
    let bestDepth = Infinity;
    let cleanBest: Cheerio<Element> | null = null;
    let cleanDepth = Infinity;
    $prices.each((index, _el) => {
      const el = $prices.eq(index);
      const depth = matchDepth(el, model, matchMemo);
      if (depth < bestDepth) {
        bestDepth = depth;
        best = el;
      }
      // Prefer a candidate that does not embed the model's own digits before
      // its price; the plain depth order would otherwise pick the SKU-bearing
      // cell and parse "CRS804-4DDQ-hRM $480.00" as 804.
      if (depth < cleanDepth && !priceComesFromModel(el.text(), model)) {
        cleanDepth = depth;
        cleanBest = el;
      }
    });
    if (cleanDepth !== Infinity) return cleanBest;
    if (bestDepth !== Infinity) return best;
  }
  return null;
}

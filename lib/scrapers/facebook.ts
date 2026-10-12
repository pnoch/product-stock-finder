export interface FacebookPrice {
  price: number;
  currency: "THB";
  title: string | null;
  inStock: boolean | null; // null = unknown availability
}

const LOGIN_WALL_RE = /log in or sign up|you must log in|log in to continue/i;
// Grounded on a real headed render of a TH marketplace item page: listing
// cards pair listing_price.amount (major units, no currency field) with a
// formatted_price ฿ glyph sibling. Anonymous renders expose these only on
// recommendation/upsell cards — the tracked item's own price sits co-located
// with its item id (signed-in render; Task 6 live check is the final gate).
const LISTING_PRICE_RE = /"listing_price":\{"amount":"([\d,]+(?:\.\d{1,2})?)"\},"formatted_price":\{"text":"(?:\\u0e3f|฿)/;
// Upsell cards use currency+amount_with_offset; amounts are minor units
// (18500000 → ฿185,000 verified against plausible listings), so ÷100.
const UPSELL_PRICE_RE = /"price":\{"currency":"THB","amount_with_offset":"([\d.]+)"\}/;
const SOLD_RE = /"is_sold":true|no longer available/i;
const ITEM_WINDOW_BEFORE = 1000;
const ITEM_WINDOW_AFTER = 2000;

// Marketplace relay JSON ships double-encoded inside script strings (quotes
// appear as \"), so match price/title fields against both spellings.
function normalizeEmbeddedJson(html: string): string {
  return html.replace(/\\"/g, '"');
}

function unescapeJsonString(value: string): string {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function round2(price: number): number {
  return Math.round(price * 100) / 100;
}

export function facebookPageReferencesItem(html: string, itemId: string): boolean {
  return html.includes(`/marketplace/item/${itemId}`)
    || html.includes(`marketplace_product_details/?id=${itemId}`)
    || normalizeEmbeddedJson(html).includes(`"item_id":"${itemId}"`);
}

function itemWindows(norm: string, itemId: string): string[] {
  const windows: string[] = [];
  let index = norm.indexOf(itemId);
  while (index !== -1) {
    windows.push(
      norm.slice(
        Math.max(0, index - ITEM_WINDOW_BEFORE),
        Math.min(norm.length, index + itemId.length + ITEM_WINDOW_AFTER),
      ),
    );
    index = norm.indexOf(itemId, index + itemId.length);
  }
  return windows;
}

function extractItemObservation(windows: string[]): { price: number; inStock: boolean | null } | null {
  for (const window of windows) {
    const listing = window.match(LISTING_PRICE_RE);
    if (listing) {
      const price = round2(Number(listing[1]!.replace(/,/g, "")));
      if (Number.isFinite(price) && price > 0) {
        return { price, inStock: SOLD_RE.test(window) ? false : null };
      }
    }
    const upsell = window.match(UPSELL_PRICE_RE);
    if (upsell) {
      const price = round2(Number(upsell[1]!) / 100);
      if (Number.isFinite(price) && price > 0) {
        return { price, inStock: SOLD_RE.test(window) ? false : null };
      }
    }
  }
  return null;
}

function extractTitle(html: string, windows: string[]): string | null {
  const ogTitle =
    html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/i) ??
    html.match(/<meta[^>]+content="([^"]*)"[^>]+property="og:title"/i);
  if (ogTitle) return decodeHtmlEntities(ogTitle[1]!).trim() || null;
  for (const window of windows) {
    const m = window.match(/"marketplace_listing_title":"([^"]{1,300})"/);
    if (m) {
      const title = unescapeJsonString(m[1]!).trim();
      if (title) return title;
    }
  }
  return null;
}

export function parseFacebookPrice(html: string, itemId: string): FacebookPrice | null {
  if (!itemId || !facebookPageReferencesItem(html, itemId)) return null;
  if (LOGIN_WALL_RE.test(html.slice(0, 4000))) return null;
  const norm = normalizeEmbeddedJson(html);
  const windows = itemWindows(norm, itemId);
  const observation = extractItemObservation(windows);
  if (!observation) return null;
  return {
    price: observation.price,
    currency: "THB",
    title: extractTitle(html, windows),
    inStock: observation.inStock,
  };
}
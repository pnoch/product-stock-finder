import * as cheerio from "cheerio";
import { parsePriceFromText } from "./utils";
import type { DistributorParser } from "./types";

export interface ShopeePrice {
  price: number;
  currency: "THB";
  variantName: string | null;
  inStock: boolean;
}

export function parseShopeePrice(
  html: string,
  shopId: string,
  itemId: string,
): ShopeePrice | null {
  if (/ต้องเข้าสู่ระบบ|verify\/traffic|is_logged_in=false/.test(html)) {
    return null;
  }
  const embedded = parseEmbeddedState(html, shopId, itemId);
  if (embedded === null) return null;
  if (embedded !== undefined) return embedded;
  const ld = parseJsonLd(html);
  if (ld) return ld;
  return parseDom(html);
}

type EmbeddedVerdict = ShopeePrice | null | undefined;

function parseEmbeddedState(
  html: string,
  shopId: string,
  itemId: string,
): EmbeddedVerdict {
  const $ = cheerio.load(html);
  const bodies: string[] = [];
  $("script").each((_, el) => {
    if ($(el).attr("type") === "application/ld+json") return;
    const text = $(el).html() ?? "";
    if (text.includes("shopid") || text.includes("shopId")) bodies.push(text);
  });
  if (bodies.length === 0) {
    const raw = findRawIds(html);
    if (raw.found && !raw.match(shopId, itemId)) return null;
    if (raw.match(shopId, itemId)) return resolveEmbedded(regexFields(html));
    return undefined;
  }
  let sawIds = false;
  for (const body of bodies) {
    for (const obj of extractJsonObjects(body)) {
      const hit = findIdentity(obj);
      if (!hit) continue;
      sawIds = true;
      if (String(hit.shop) === shopId && String(hit.item) === itemId) {
        return resolveEmbedded(collectFields(obj));
      }
    }
  }
  if (sawIds) return null;
  const raw = findRawIds(bodies.join("\n"));
  if (raw.found) {
    if (!raw.match(shopId, itemId)) return null;
    return resolveEmbedded(regexFields(bodies.join("\n")));
  }
  return undefined;
}

interface CollectedFields {
  price?: unknown;
  priceMin?: unknown;
  priceMax?: unknown;
  stock?: unknown;
  selectedPrice?: unknown;
  selectedStock?: unknown;
  variantName?: unknown;
  currency?: unknown;
}

function collectFields(root: unknown): CollectedFields {
  const out: CollectedFields = {};
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const v of node) visit(v);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const rec = node as Record<string, unknown>;
    if (out.price === undefined && rec["price"] !== undefined) {
      out.price = rec["price"];
    }
    if (out.priceMin === undefined) {
      out.priceMin = rec["price_min"] ?? rec["priceMin"];
    }
    if (out.priceMax === undefined) {
      out.priceMax = rec["price_max"] ?? rec["priceMax"];
    }
    if (out.stock === undefined && typeof rec["stock"] !== "object") {
      out.stock = rec["stock"];
    }
    if (out.currency === undefined) {
      out.currency = rec["priceCurrency"] ?? rec["currency"];
    }
    const selected =
      rec["selected_model"] ?? rec["selectedModel"] ?? rec["selected_variant"];
    if (selected !== undefined && out.selectedPrice === undefined) {
      if (typeof selected === "object" && selected !== null) {
        const s = selected as Record<string, unknown>;
        out.selectedPrice = s["price"];
        out.selectedStock = s["stock"];
        out.variantName = s["name"];
      } else if (typeof selected === "string") {
        out.variantName = selected;
      }
    }
    if (out.variantName === undefined) {
      const variation = rec["variation"];
      if (typeof variation === "string") out.variantName = variation;
      else if (
        typeof variation === "object" &&
        variation !== null &&
        typeof (variation as Record<string, unknown>)["name"] === "string"
      ) {
        out.variantName = (variation as Record<string, unknown>)["name"];
      }
    }
    for (const v of Object.values(rec)) visit(v);
  };
  visit(root);
  return out;
}

function regexFields(text: string): CollectedFields {
  const num = (re: RegExp): unknown => {
    const m = text.match(re);
    return m ? m[1] : undefined;
  };
  const str = (re: RegExp): unknown => {
    const m = text.match(re);
    return m ? m[1] : undefined;
  };
  return {
    price: num(/"price"\s*:\s*"?([\d.,]+)"?/),
    priceMin: num(/"price_min"\s*:\s*"?([\d.,]+)"?/),
    priceMax: num(/"price_max"\s*:\s*"?([\d.,]+)"?/),
    stock: num(/"stock"\s*:\s*(\d+)/),
    selectedPrice: num(/"selected_model"\s*:\s*\{[^}]*?"price"\s*:\s*"?([\d.,]+)"?/),
    variantName:
      str(/"selected_model"\s*:\s*\{[^}]*?"name"\s*:\s*"([^"]+)"/) ??
      str(/"variation"\s*:\s*"([^"]+)"/),
    currency:
      str(/"priceCurrency"\s*:\s*"([^"]+)"/) ??
      str(/"currency"\s*:\s*"([^"]+)"/),
  };
}

function resolveEmbedded(f: CollectedFields): ShopeePrice | null {
  if (
    typeof f.currency === "string" &&
    f.currency !== "THB" &&
    f.currency !== "฿"
  ) {
    return null;
  }
  const selected = toPositiveNumber(f.selectedPrice);
  if (selected !== null) {
    return {
      price: selected,
      currency: "THB",
      variantName:
        typeof f.variantName === "string" ? f.variantName : null,
      inStock: stockOf(f.selectedStock ?? f.stock),
    };
  }
  const price = toPositiveNumber(f.price);
  const pmin = toPositiveNumber(f.priceMin);
  const pmax = toPositiveNumber(f.priceMax);
  if (pmin !== null && pmax !== null && pmin !== pmax) return null;
  const single = price ?? (pmin !== null && pmin === pmax ? pmin : null);
  if (single === null) return null;
  return {
    price: single,
    currency: "THB",
    variantName:
      typeof f.variantName === "string" ? f.variantName : null,
    inStock: stockOf(f.stock),
  };
}

function stockOf(value: unknown): boolean {
  if (typeof value === "number") return value > 0;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(/,/g, ""));
    return Number.isFinite(n) ? n > 0 : true;
  }
  return true;
}

function toPositiveNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  if (typeof value === "string") {
    const n = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

function findIdentity(root: unknown): { shop: unknown; item: unknown } | null {
  let found: { shop: unknown; item: unknown } | null = null;
  const visit = (node: unknown): void => {
    if (found || Array.isArray(node)) {
      if (Array.isArray(node)) for (const v of node) visit(v);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const rec = node as Record<string, unknown>;
    const shop = rec["shopid"] ?? rec["shopId"] ?? rec["shop_id"];
    const item = rec["itemid"] ?? rec["itemId"] ?? rec["item_id"];
    if (shop !== undefined && item !== undefined) {
      found = { shop, item };
      return;
    }
    for (const v of Object.values(rec)) visit(v);
  };
  visit(root);
  return found;
}

function extractJsonObjects(text: string): unknown[] {
  const out: unknown[] = [];
  for (const span of braceSpans(text).sort((a, b) => b.length - a.length)) {
    try {
      out.push(JSON.parse(span));
    } catch {
      continue;
    }
  }
  return out;
}

function braceSpans(text: string): string[] {
  const spans: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let quote = "";
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inString = true;
      quote = ch;
    } else if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        spans.push(text.slice(start, i + 1));
        start = -1;
      }
      if (depth < 0) depth = 0;
    }
  }
  return spans;
}

const ID_RE = (key: string): RegExp =>
  new RegExp(`"${key}"\\s*:\\s*"?([0-9]+)"?`);

function findRawIds(text: string): {
  found: boolean;
  match: (shopId: string, itemId: string) => boolean;
} {
  const shops = new Set<string>();
  const items = new Set<string>();
  for (const key of ["shopid", "shopId", "shop_id"]) {
    for (const m of text.matchAll(new RegExp(ID_RE(key), "g"))) {
      shops.add(m[1]!);
    }
  }
  for (const key of ["itemid", "itemId", "item_id"]) {
    for (const m of text.matchAll(new RegExp(ID_RE(key), "g"))) {
      items.add(m[1]!);
    }
  }
  return {
    found: shops.size > 0 || items.size > 0,
    match: (shopId, itemId) => shops.has(shopId) && items.has(itemId),
  };
}

// JSON-LD comes from the loaded canonical URL which the caller already
// validated, so no shop/item identity check applies on this branch.
function parseJsonLd(html: string): ShopeePrice | null {
  const $ = cheerio.load(html);
  const blocks: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).html() ?? "";
    try {
      const parsed: unknown = JSON.parse(text);
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch {
      return;
    }
  });
  for (const block of blocks) {
    const product = findProduct(block);
    if (!product) continue;
    const offers = product["offers"];
    const offer = Array.isArray(offers) ? offers[0] : offers;
    if (typeof offer !== "object" || offer === null) continue;
    const o = offer as Record<string, unknown>;
    if (typeof o["priceCurrency"] === "string" && o["priceCurrency"] !== "THB") {
      return null;
    }
    const price = toPositiveNumber(o["price"] ?? o["lowPrice"]);
    if (price === null) continue;
    return {
      price,
      currency: "THB",
      variantName: null,
      inStock: availabilityInStock(o["availability"]),
    };
  }
  return null;
}

function findProduct(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const v of node) {
      const hit = findProduct(v);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof node !== "object" || node === null) return null;
  const rec = node as Record<string, unknown>;
  const type = rec["@type"];
  if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) {
    return rec;
  }
  const graph = rec["@graph"];
  if (graph !== undefined) return findProduct(graph);
  return null;
}

function availabilityInStock(value: unknown): boolean {
  if (typeof value === "string") {
    if (/OutOfStock|SoldOut/i.test(value)) return false;
    return true;
  }
  return true;
}

const OTHER_CURRENCY =
  /[$€£¥₫₱₹₩]|\bRM\b|\b(?:USD|EUR|GBP|MYR|AUD|NZD|CAD|ZAR|SGD|HKD|AED)\b/i;
const THB_MARKER = /฿|\bTHB\b|บาท/;
const RANGE = /[\d.,]+\s*[-–~]\s*฿?\s*[\d.,]+/;
const SOLD_OUT = /sold out|out of stock|สินค้าหมด|ขายหมด|หมดสต็อก/i;

function parseDom(html: string): ShopeePrice | null {
  const $ = cheerio.load(html);
  const candidates = $(
    '[itemprop="price"], [class*="price"], [class*="Price"], .pdp-price, .product-price',
  );
  for (let i = 0; i < candidates.length; i++) {
    const text = candidates.eq(i).text().replace(/\s+/g, " ").trim();
    if (!text || RANGE.test(text)) continue;
    if (OTHER_CURRENCY.test(text) && !THB_MARKER.test(text)) continue;
    const price = parsePriceFromText(text);
    if (price === null) continue;
    const variant =
      $('[aria-selected="true"], .selected, [class*="selected"], option[selected]')
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim() || null;
    return {
      price,
      currency: "THB",
      variantName: variant || null,
      inStock: !SOLD_OUT.test($("body").text()),
    };
  }
  return null;
}

function modelIds(model?: string): { shopId: string; itemId: string } | null {
  const m = model?.match(/^shopee-th-([1-9]\d{0,19})-([1-9]\d{0,19})$/);
  return m ? { shopId: m[1]!, itemId: m[2]! } : null;
}

export const shopeeThParser: DistributorParser = {
  id: "shopee-th",
  baseUrl: "https://shopee.co.th",
  buildSearchUrl: (model) => {
    const ids = modelIds(model);
    return ids
      ? `https://shopee.co.th/product/${ids.shopId}/${ids.itemId}`
      : "https://shopee.co.th";
  },
  parsePrice: (html, model, url) => {
    const ids = modelIds(model);
    const found = ids ? parseShopeePrice(html, ids.shopId, ids.itemId) : null;
    if (!found) return null;
    return {
      price: found.price,
      currency: "THB",
      stockStatus: found.inStock ? "in_stock" : "out_of_stock",
      url: url ?? "https://shopee.co.th",
      variantName: found.variantName ?? undefined,
    };
  },
  rateLimitMs: 60000,
  useBrowser: true,
};

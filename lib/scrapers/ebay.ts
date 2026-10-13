import type { DistributorParser, ScrapeResult } from "./types";

export interface EbayPrice {
  price: number;
  currency: string; // observed (USD on ebay.com; THB appears as eBay's conversion)
  title: string | null;
  inStock: boolean;
  condition: string | null;
}

const WBR = /<wbr\/?>/g;

function stripWbr(value: string): string {
  return value.replace(WBR, "");
}

interface JsonLdProduct {
  price: number;
  currency: string;
  title: string | null;
  inStock: boolean;
  condition: string | null;
}

function parseJsonLdProduct(html: string): JsonLdProduct | null {
  const blocks =
    html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g) ?? [];
  for (const block of blocks) {
    const raw = block.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    const items = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const product = item as Record<string, unknown>;
      if (product["@type"] !== "Product") continue;
      const offers = product["offers"] as Record<string, unknown> | undefined;
      if (!offers || typeof offers !== "object") continue;
      const price = Number(offers["price"]);
      const currency =
        typeof offers["priceCurrency"] === "string" ? offers["priceCurrency"] : null;
      if (!Number.isFinite(price) || price <= 0 || !currency) continue;
      const availability =
        typeof offers["availability"] === "string" ? offers["availability"] : "";
      const condition =
        typeof offers["itemCondition"] === "string" ? offers["itemCondition"] : null;
      return {
        price,
        currency,
        title: typeof product["name"] === "string" ? stripWbr(product["name"]) : null,
        inStock: availability.includes("InStock"),
        condition: condition?.includes("NewCondition")
          ? "New"
          : condition?.includes("UsedCondition")
            ? "Used"
            : null,
      };
    }
  }
  return null;
}

export function parseEbayPrice(html: string, itemId: string): EbayPrice | null {
  // Identity guard: the page must reference our item.
  if (!html.includes(`/itm/${itemId}`) && !html.includes(`"itemId":"${itemId}"`)) return null;
  // Login wall / error pages.
  if (/Sign in or register|Error Page/i.test(html.slice(0, 4000)) && !parseJsonLdProduct(html)) {
    return null;
  }
  const found = parseJsonLdProduct(html);
  if (!found) return null;
  return found;
}

function modelIds(model?: string): string | null {
  const m = model?.match(/^ebay-us-([1-9]\d{0,19})$/);
  return m ? m[1]! : null;
}

function parseProductPage(
  html: string,
  url: string | undefined,
  itemId: string,
): ScrapeResult | null {
  const found = parseEbayPrice(html, itemId);
  if (!found) return null;
  return {
    price: found.price,
    currency: found.currency,
    stockStatus: found.inStock ? "in_stock" : "out_of_stock",
    url: url ?? `https://www.ebay.com/itm/${itemId}`,
    variantName: undefined,
  };
}

export const ebayParser: DistributorParser = {
  id: "ebay-us",
  baseUrl: "https://www.ebay.com",
  buildSearchUrl: (model) => {
    const id = modelIds(model);
    return id ? `https://www.ebay.com/itm/${id}` : "https://www.ebay.com";
  },
  parsePrice: (html, model, url) => {
    const id = modelIds(model);
    if (!id) return null;
    return parseProductPage(html, url, id);
  },
  rateLimitMs: 60000,
  useBrowser: true,
};

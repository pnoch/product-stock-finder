import type { DistributorParser, ScrapeResult } from "./types";

export interface LazadaPrice {
  price: number;
  currency: "THB";
  variantName: string | null;
  inStock: boolean;
}

function parseThb(text: string): number | null {
  const m = text.replace(/,/g, "").match(/฿\s*([\d.]+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

export function parseLazadaPrice(
  html: string,
  itemId: string,
  skuId: string,
): LazadaPrice | null {
  // Identity guard: page must reference our item.
  const idOk =
    html.includes(`${itemId}_TH-${skuId}`) ||
    html.includes(`_p_item=${itemId}`);
  if (!idOk) return null;
  // Selected-sku guard: refuse the price when the page's selected sku differs.
  // Grounded 2026-10-12: `_p_sku=127341978928` and `"pdt_simplesku":127341978928`
  // (unquoted numeric, plain + backslash-escaped copies). (?!\d) blocks prefix
  // false-positives (sku "1273" matching "127341978928").
  const selOk =
    new RegExp(`_p_sku=${skuId}(?!\\d)`).test(html) ||
    new RegExp(`pdt_simplesku\\\\?":${skuId}(?!\\d)`).test(html);
  // Price: first pdt_price occurrence (plain `"pdt_price":"฿…"` or escaped).
  const pm =
    html.match(/pdt_price\\?":\\?"([^"\\]+)"/) ??
    html.match(/pdt_price":"([^"]+)"/);
  const price = pm ? parseThb(pm[1]!) : null;
  if (price === null || !selOk) return null;
  // Stock from JSON-LD availability.
  const oos =
    /"availability"\s*:\s*"https?:\/\/schema\.org\/OutOfStock"/.test(html);
  // og:title is the product title, not the variant — variant stays user-entered.
  return { price, currency: "THB", variantName: null, inStock: !oos };
}

function modelIds(model?: string): { itemId: string; skuId: string } | null {
  const m = model?.match(/^lazada-th-([1-9]\d{0,19})-([1-9]\d{0,19})$/);
  return m ? { itemId: m[1]!, skuId: m[2]! } : null;
}

function parseProductPage(
  html: string,
  url: string | undefined,
  itemId: string,
  skuId: string,
): ScrapeResult | null {
  const found = parseLazadaPrice(html, itemId, skuId);
  if (!found) return null;
  return {
    price: found.price,
    currency: "THB",
    stockStatus: found.inStock ? "in_stock" : "out_of_stock",
    url: url ?? `https://www.lazada.co.th/products/i${itemId}-s${skuId}.html`,
    variantName: found.variantName ?? undefined,
  };
}

export const lazadaThParser: DistributorParser = {
  id: "lazada-th",
  baseUrl: "https://www.lazada.co.th",
  buildSearchUrl: (model) => {
    const ids = modelIds(model);
    return ids
      ? `https://www.lazada.co.th/products/i${ids.itemId}-s${ids.skuId}.html`
      : "https://www.lazada.co.th";
  },
  parsePrice: (html, model, url) => {
    const ids = modelIds(model);
    if (!ids) return null;
    return parseProductPage(html, url, ids.itemId, ids.skuId);
  },
  rateLimitMs: 60000,
  // Plain first (works from datacenters); standard escalation on failure.
};

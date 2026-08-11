import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithRateLimit, parsePriceFromText, inferStockStatus } from "./utils";
import { getTaxRate } from "../tax";

function parseHtml(html: string, url: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const priceText = $(".product-price, .product-detail-price, [itemprop='price'], .price").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(".product-detail-delivery-status, .delivery-status, .availability, .stock-status").first().text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "EUR",
    stockStatus,
    url,
    taxRate: getTaxRate("Germany"),
  };
}

export const mikrotikstoreParser: DistributorParser = {
  id: "mikrotikstore-de",
  baseUrl: "https://mikrotik-store.eu",
  buildSearchUrl: (model) =>
    `https://mikrotik-store.eu/en/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://mikrotik-store.eu"),
  rateLimitMs: 3000,
};

export async function scrapeMikrotikStore(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = mikrotikstoreParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, mikrotikstoreParser.rateLimitMs);
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

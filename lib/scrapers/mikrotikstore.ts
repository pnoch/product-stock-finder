import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithRateLimit, parsePriceFromText, inferStockStatus } from "./utils";

function parseHtml(html: string, url: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const priceText = $(".product-price, .price, [data-price]").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(".stock-status, .availability, .stock").first().text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "EUR",
    stockStatus,
    url,
  };
}

export const mikrotikstoreParser: DistributorParser = {
  id: "mikrotikstore-de",
  baseUrl: "https://mikrotikstore.de",
  buildSearchUrl: (model) =>
    `https://mikrotikstore.de/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://mikrotikstore.de"),
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

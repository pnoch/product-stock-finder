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

export const geticParser: DistributorParser = {
  id: "getic-gr",
  baseUrl: "https://getic.gr",
  buildSearchUrl: (model) =>
    `https://getic.gr/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://getic.gr"),
  rateLimitMs: 3000,
};

export async function scrapeGetic(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = geticParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, geticParser.rateLimitMs);
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

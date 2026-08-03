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
    currency: "USD",
    stockStatus,
    url,
  };
}

export const rocnocParser: DistributorParser = {
  id: "rocnoc-us",
  baseUrl: "https://rocnoc.com",
  buildSearchUrl: (model) =>
    `https://rocnoc.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://rocnoc.com"),
  rateLimitMs: 3000,
};

export async function scrapeRocnoc(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = rocnocParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, rocnocParser.rateLimitMs);
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

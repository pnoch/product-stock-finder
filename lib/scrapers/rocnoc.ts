import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import {
  fetchWithRateLimit,
  parsePriceFromText,
  inferStockStatus,
} from "./utils";
import { getTaxRate } from "../tax";

function parseHtml(html: string, url: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const priceText = $(".price, .product-price, td:contains('$')")
    .first()
    .text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(".stock, .availability, .product-stock, .stock-status")
    .first()
    .text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "USD",
    stockStatus,
    url,
    taxRate: getTaxRate("United States"),
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

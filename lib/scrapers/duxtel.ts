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

  const priceText = $(".product-price, .price, [data-product-price]")
    .first()
    .text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(".stock-status, .availability, .product-stock")
    .first()
    .text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "AUD",
    stockStatus,
    url,
    taxRate: getTaxRate("Australia"),
  };
}

export const duxtelParser: DistributorParser = {
  id: "duxtel-au",
  baseUrl: "https://store.duxtel.com",
  buildSearchUrl: (model) =>
    `https://store.duxtel.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://store.duxtel.com"),
  rateLimitMs: 3000,
};

export async function scrapeDuxtel(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = duxtelParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, duxtelParser.rateLimitMs);
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

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

  const priceText = $(".product-price, .price4, .price").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(
    ".in-stock.status4, .call-for-stock.status4, .stock-status, .availability",
  )
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

export const neobitsParser: DistributorParser = {
  id: "neobits-us",
  baseUrl: "https://neobits.com",
  buildSearchUrl: (model) =>
    `https://neobits.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://neobits.com"),
  rateLimitMs: 3000,
};

export async function scrapeNeobits(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = neobitsParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, neobitsParser.rateLimitMs);
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

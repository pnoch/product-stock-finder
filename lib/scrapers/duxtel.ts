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
    currency: "AUD",
    stockStatus,
    url,
  };
}

export const duxtelParser: DistributorParser = {
  id: "duxtel-au",
  baseUrl: "https://duxtel.com",
  buildSearchUrl: (model) =>
    `https://duxtel.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://duxtel.com"),
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

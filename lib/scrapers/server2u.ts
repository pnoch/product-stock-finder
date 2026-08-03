import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithRateLimit, parsePriceFromText, inferStockStatus } from "./utils";

async function parseHtml(html: string, url: string): Promise<ScrapeResult | null> {
  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);
  
  const priceText = $(".product-price, .price, [data-price]").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;
  
  const stockText = $(".stock-status, .availability, .stock").first().text();
  const stockStatus = inferStockStatus(stockText);
  
  return {
    price,
    currency: "MYR",
    stockStatus,
    url,
  };
}

export const server2uParser: DistributorParser = {
  id: "server2u-my",
  baseUrl: "https://server2u.com",
  buildSearchUrl: (model) => `https://server2u.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeServer2U(model: string): Promise<ScrapeResult | null> {
  const url = server2uParser.buildSearchUrl(model);
  const html = await fetchWithRateLimit(url, server2uParser.rateLimitMs);
  return parseHtml(html, url);
}

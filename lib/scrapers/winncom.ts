import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithRateLimit, parsePriceFromText, inferStockStatus } from "./utils";

function parseHtml(html: string, url: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const priceText = $(".product-link, .nobr, td a[href*='/products/'], .price").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(".stock, .availability, .stock-status, td:contains('In Stock')").first().text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "USD",
    stockStatus,
    url,
  };
}

export const winncomParser: DistributorParser = {
  id: "winncom-us",
  baseUrl: "https://winncom.com",
  buildSearchUrl: (model) =>
    `https://winncom.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://winncom.com"),
  rateLimitMs: 3000,
};

export async function scrapeWinncom(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = winncomParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, winncomParser.rateLimitMs);
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

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

export const megaParser: DistributorParser = {
  id: "100mega-cz",
  baseUrl: "https://100mega.cz",
  buildSearchUrl: (model) =>
    `https://100mega.cz/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://100mega.cz"),
  rateLimitMs: 3000,
};

export async function scrapeMega(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = megaParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, megaParser.rateLimitMs);
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

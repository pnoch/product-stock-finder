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
    currency: "CAD",
    stockStatus,
    url,
  };
}

export const mbsiwavParser: DistributorParser = {
  id: "mbsiwav-ca",
  baseUrl: "https://mbsiwav.com",
  buildSearchUrl: (model) =>
    `https://mbsiwav.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://mbsiwav.com"),
  rateLimitMs: 3000,
};

export async function scrapeMbsiwav(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = mbsiwavParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, mbsiwavParser.rateLimitMs);
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

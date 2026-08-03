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
    currency: "NZD",
    stockStatus,
    url,
  };
}

export const pbtechParser: DistributorParser = {
  id: "pbtech-nz",
  baseUrl: "https://pbtech.co.nz",
  buildSearchUrl: (model) =>
    `https://pbtech.co.nz/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://pbtech.co.nz"),
  rateLimitMs: 3000,
};

export async function scrapePbtech(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = pbtechParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, pbtechParser.rateLimitMs);
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

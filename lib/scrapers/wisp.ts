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

export const wispParser: DistributorParser = {
  id: "wisp-au",
  baseUrl: "https://wisp.net.au",
  buildSearchUrl: (model) =>
    `https://wisp.net.au/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://wisp.net.au"),
  rateLimitMs: 3000,
};

export async function scrapeWisp(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = wispParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, wispParser.rateLimitMs);
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithParser, parsePriceFromText, inferStockStatus } from "./utils";
import { getTaxRate } from "../tax";

function parseHtml(html: string, url: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const priceText = $(".product-price, .price, [data-product-price]").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(".stock-status, .availability, .product-stock").first().text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "EUR",
    stockStatus,
    url,
    taxRate: getTaxRate("European Union"),
  };
}

export const nasstoreParser: DistributorParser = {
  id: "nasstore-eu",
  baseUrl: "https://nasstore.eu",
  buildSearchUrl: (model) =>
    `https://nasstore.eu/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://nasstore.eu"),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-price, .price",
  },
};

export async function scrapeNasstore(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = nasstoreParser.buildSearchUrl(model);
    const html = await fetchWithParser(nasstoreParser, url);
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

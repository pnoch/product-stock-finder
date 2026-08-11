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
    currency: "USD",
    stockStatus,
    url,
    taxRate: getTaxRate("United States"),
  };
}

export const networkdevicesParser: DistributorParser = {
  id: "networkdevices-us",
  baseUrl: "https://networkdevices.com",
  buildSearchUrl: (model) =>
    `https://networkdevices.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://networkdevices.com"),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-price, .price",
  },
};

export async function scrapeNetworkDevices(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = networkdevicesParser.buildSearchUrl(model);
    const html = await fetchWithParser(networkdevicesParser, url);
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

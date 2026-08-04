import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithParser, parsePriceFromText, inferStockStatus } from "./utils";

function parseHtml(html: string, url: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const priceText = $(".product-price, .price, [data-product-price]").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(".stock-status, .availability, .product-stock").first().text();
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
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-price, .price",
  },
};

export async function scrapeWisp(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = wispParser.buildSearchUrl(model);
    const html = await fetchWithParser(wispParser, url);
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

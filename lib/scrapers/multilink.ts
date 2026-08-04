import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithParser, parsePriceFromText, inferStockStatus } from "./utils";

function parseHtml(html: string, url: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const priceText = $(".product-price, .price--withoutTax, [data-product-price-without-tax], .price").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(".product-details__stock, .availability, .stock, .stock-status").first().text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "USD",
    stockStatus,
    url,
  };
}

export const multilinkParser: DistributorParser = {
  id: "multilink-us",
  baseUrl: "https://multilink.us",
  buildSearchUrl: (model) =>
    `https://multilink.us/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://multilink.us"),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-price, .price",
  },
};

export async function scrapeMultilink(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = multilinkParser.buildSearchUrl(model);
    const html = await fetchWithParser(multilinkParser, url);
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

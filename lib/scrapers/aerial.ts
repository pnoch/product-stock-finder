import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithParser, parsePriceFromText, inferStockStatus } from "./utils";
import { getTaxRate } from "../tax";

function parseHtml(html: string, url: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const priceText = $(".ac-price, .product-price, .price").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(".stock, .availability, .product-stock, .stock-status")
    .first()
    .text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "EUR",
    stockStatus,
    url,
    taxRate: getTaxRate("Greece"),
  };
}

export const aerialParser: DistributorParser = {
  id: "aerial-gr",
  baseUrl: "https://aerial.net",
  buildSearchUrl: (model) =>
    `https://aerial.net/shop?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://aerial.net"),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".ac-price, .product-price",
  },
};

export async function scrapeAerial(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = aerialParser.buildSearchUrl(model);
    const html = await fetchWithParser(aerialParser, url);
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

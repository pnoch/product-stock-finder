import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import {
  fetchWithParser,
  parsePriceFromText,
  inferStockStatus,
  modelMismatch,
} from "./utils";
import { getTaxRate } from "../tax";

function parseHtml(
  html: string,
  url: string,
  model?: string,
): ScrapeResult | null {
  const $ = cheerio.load(html);

  const $price = $(".product-price, .price, [data-product-price]").first();
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($, $price, model)) return null;

  const stockText = $(".stock-status, .availability, .product-stock")
    .first()
    .text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "NZD",
    stockStatus,
    url,
    taxRate: getTaxRate("New Zealand"),
  };
}

export const gowifiParser: DistributorParser = {
  id: "gowifi-nz",
  baseUrl: "https://gowifi.co.nz",
  buildSearchUrl: (model) =>
    `https://gowifi.co.nz/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html, model) => parseHtml(html, "https://gowifi.co.nz", model),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-price, .price",
  },
};

export async function scrapeGowifi(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = gowifiParser.buildSearchUrl(model);
    const html = await fetchWithParser(gowifiParser, url);
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

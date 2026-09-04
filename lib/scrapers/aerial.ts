import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import {
  fetchWithParser,
  parsePriceFromText,
  findPriceElement,
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

  const $price = findPriceElement($, ".ac-price, .product-price, .price", model);
  if (!$price || $price.length === 0) return null;
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($price, model)) return null;

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
  parsePrice: (html, model, url) => parseHtml(html, url ?? "https://aerial.net", model),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".feat-pricerow",
  },
};

export async function scrapeAerial(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = aerialParser.buildSearchUrl(model);
    const html = await fetchWithParser(aerialParser, url);
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

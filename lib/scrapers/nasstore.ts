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

  const $price = findPriceElement($, ".product-price, .price, [data-product-price]", model);
  if (!$price || $price.length === 0) return null;
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($price, model)) return null;

  const stockText = $(".stock-status, .availability, .product-stock")
    .first()
    .text();
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
  parsePrice: (html, model, url) => parseHtml(html, url ?? "https://nasstore.eu", model),
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
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

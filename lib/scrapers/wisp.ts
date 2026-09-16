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
    currency: "AUD",
    stockStatus,
    url,
    taxRate: getTaxRate("Australia"),
  };
}

export const wispParser: DistributorParser = {
  id: "wisp-au",
  baseUrl: "https://wisp.net.au",
  buildSearchUrl: (model) =>
    `https://wisp.net.au/module/iqitsearch/searchiqit?s=${encodeURIComponent(model)}`,
  parsePrice: (html, model, url) => parseHtml(html, url ?? "https://wisp.net.au", model),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-price, .price",
  },
};

export async function scrapeWisp(model: string): Promise<ScrapeResult | null> {
  try {
    const url = wispParser.buildSearchUrl(model);
    const html = await fetchWithParser(wispParser, url);
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

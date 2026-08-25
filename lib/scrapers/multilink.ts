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

  const $price = $(".product-price, .price--withoutTax, [data-product-price-without-tax], .price").first();
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($, $price, model)) return null;

  const stockText = $(
    ".product-details__stock, .availability, .stock, .stock-status",
  )
    .first()
    .text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "USD",
    stockStatus,
    url,
    taxRate: getTaxRate("United States"),
  };
}

export const multilinkParser: DistributorParser = {
  id: "multilink-us",
  baseUrl: "https://multilink.us",
  buildSearchUrl: (model) =>
    `https://multilink.us/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html, model) => parseHtml(html, "https://multilink.us", model),
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
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

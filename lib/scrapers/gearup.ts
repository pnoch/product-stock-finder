import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import {
  fetchWithRateLimit,
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
    currency: "AED",
    stockStatus,
    url,
    taxRate: getTaxRate("UAE"),
  };
}

export const gearupParser: DistributorParser = {
  id: "gearup-ae",
  baseUrl: "https://gearup.me",
  buildSearchUrl: (model) =>
    `https://gearup.me/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html, model) => parseHtml(html, "https://gearup.me", model),
  rateLimitMs: 3000,
};

export async function scrapeGearup(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = gearupParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, gearupParser.rateLimitMs);
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

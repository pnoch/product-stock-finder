import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import {
  fetchWithRateLimit,
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

  const $price = findPriceElement($, ".price, .product-price, td:contains('$')", model);
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
    currency: "USD",
    stockStatus,
    url,
    taxRate: getTaxRate("United States"),
  };
}

export const rocnocParser: DistributorParser = {
  id: "rocnoc-us",
  baseUrl: "https://rocnoc.com",
  buildSearchUrl: (model) =>
    `https://rocnoc.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html, model, url) => parseHtml(html, url ?? "https://rocnoc.com", model),
  rateLimitMs: 3000,
};

export async function scrapeRocnoc(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = rocnocParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, rocnocParser.rateLimitMs);
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

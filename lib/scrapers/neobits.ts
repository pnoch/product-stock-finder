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

  const $price = findPriceElement($, ".product-price, .price4, .price", model);
  if (!$price || $price.length === 0) return null;
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($price, model)) return null;

  const stockText = $(
    ".in-stock.status4, .call-for-stock.status4, .stock-status, .availability",
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

export const neobitsParser: DistributorParser = {
  id: "neobits-us",
  baseUrl: "https://neobits.com",
  // The storefront search box submits to `/search?keywords=`; the old
  // `search_param=all&main_search_field=` form returned the homepage.
  buildSearchUrl: (model) =>
    `https://www.neobits.com/search?keywords=${encodeURIComponent(model)}`,
  parsePrice: (html, model, url) =>
    parseHtml(html, url ?? "https://www.neobits.com", model),
  useBrowser: true,
  rateLimitMs: 3000,
};

export async function scrapeNeobits(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = neobitsParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, neobitsParser.rateLimitMs);
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

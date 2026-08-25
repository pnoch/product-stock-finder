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

  const $price = $(".product-price, .price, [data-product-price], [itemprop='price']").first();
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($, $price, model)) return null;

  const stockText = $(
    ".stock-status, .availability, .stock, [itemprop='availability']",
  )
    .first()
    .text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "MYR",
    stockStatus,
    url,
    taxRate: getTaxRate("Malaysia"),
  };
}

export const server2uParser: DistributorParser = {
  id: "server2u-my",
  baseUrl: "https://server2u.com",
  buildSearchUrl: (model) =>
    `https://server2u.com/shop?q=${encodeURIComponent(model)}`,
  parsePrice: (html, model) => parseHtml(html, "https://server2u.com", model),
  rateLimitMs: 2000,
};

export async function scrapeServer2U(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = server2uParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, server2uParser.rateLimitMs);
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

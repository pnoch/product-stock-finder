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

export const duxtelParser: DistributorParser = {
  id: "duxtel-au",
  baseUrl: "https://store.duxtel.com",
  buildSearchUrl: (model) =>
    `https://store.duxtel.com/index.php?route=product/search&search=${encodeURIComponent(model)}`,
  parsePrice: (html, model, url) =>
    parseHtml(html, url ?? "https://store.duxtel.com", model),
  rateLimitMs: 3000,
};

export async function scrapeDuxtel(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = duxtelParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, duxtelParser.rateLimitMs);
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

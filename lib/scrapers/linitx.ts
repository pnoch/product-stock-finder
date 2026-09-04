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

  const $price = findPriceElement($, ".prodprice, .product__price, .price", model);
  if (!$price || $price.length === 0) return null;
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($price, model)) return null;

  const stockText = $(".prodinfo-stock-view-status, .product__stock, .stock")
    .first()
    .text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "GBP",
    stockStatus,
    url,
    taxRate: getTaxRate("United Kingdom"),
  };
}

export const linitxParser: DistributorParser = {
  id: "linitx-uk",
  baseUrl: "https://linitx.com",
  buildSearchUrl: (model) =>
    `https://linitx.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html, model, url) => parseHtml(html, url ?? "https://linitx.com", model),
  rateLimitMs: 3000,
};

export async function scrapeLinitx(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = linitxParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, linitxParser.rateLimitMs);
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

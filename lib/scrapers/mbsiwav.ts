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

  const $price = $(".product-views-price, .product-views-price-exact, .product-views-price-lead, .price").first();
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($price, model)) return null;

  const stockText = $(".item-stock, .stock-status").first().text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "CAD",
    stockStatus,
    url,
    taxRate: getTaxRate("Canada"),
  };
}

export const mbsiwavParser: DistributorParser = {
  id: "mbsiwav-ca",
  baseUrl: "https://mbsiwav.com",
  buildSearchUrl: (model) =>
    `https://mbsiwav.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html, model) => parseHtml(html, "https://mbsiwav.com", model),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-views-price",
  },
};

export async function scrapeMbsiwav(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = mbsiwavParser.buildSearchUrl(model);
    const html = await fetchWithParser(mbsiwavParser, url);
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

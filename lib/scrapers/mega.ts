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

  const $price = findPriceElement($, ".product-price, .price, [data-price], [itemprop='price']", model);
  if (!$price || $price.length === 0) return null;
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($price, model)) return null;

  const stockText = $(".stock-status, .availability, .stock, .product-stock")
    .first()
    .text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "EUR",
    stockStatus,
    url,
    taxRate: getTaxRate("Czech Republic"),
  };
}

export const megaParser: DistributorParser = {
  id: "100mega-cz",
  baseUrl: "https://b2b.100mega.com",
  buildSearchUrl: (model) =>
    `https://b2b.100mega.com/en/?SearchText=${encodeURIComponent(model)}`,
  parsePrice: (html, model, url) => parseHtml(html, url ?? "https://b2b.100mega.com", model),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-price, .price",
  },
};

export async function scrapeMega(model: string): Promise<ScrapeResult | null> {
  try {
    const url = megaParser.buildSearchUrl(model);
    const html = await fetchWithParser(megaParser, url);
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

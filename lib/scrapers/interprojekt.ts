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

  const $price = $(".price").first();
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($price, model)) return null;

  const stockText = $(".stock_status, .stock-status").first().text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "EUR",
    stockStatus,
    url,
    taxRate: getTaxRate("Poland"),
  };
}

export const interprojektParser: DistributorParser = {
  id: "interprojekt-pl",
  baseUrl: "https://interprojekt.pl",
  buildSearchUrl: (model) =>
    `https://interprojekt.pl/en/catalogsearch/result/?q=${encodeURIComponent(model)}`,
  parsePrice: (html, model) => parseHtml(html, "https://interprojekt.pl", model),
  rateLimitMs: 3000,
};

export async function scrapeInterprojekt(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = interprojektParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, interprojektParser.rateLimitMs);
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

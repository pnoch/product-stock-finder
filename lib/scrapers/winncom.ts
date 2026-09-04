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

  const $price = findPriceElement($, ".product-link, .nobr, td a[href*='/products/'], .price", model);
  if (!$price || $price.length === 0) return null;
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($price, model)) return null;

  const stockText = $(
    ".stock, .availability, .stock-status, td:contains('In Stock')",
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

export const winncomParser: DistributorParser = {
  id: "winncom-us",
  baseUrl: "https://winncom.com",
  buildSearchUrl: (model) =>
    `https://winncom.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html, model, url) => parseHtml(html, url ?? "https://winncom.com", model),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-link, .price",
  },
};

export async function scrapeWinncom(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = winncomParser.buildSearchUrl(model);
    const html = await fetchWithParser(winncomParser, url);
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

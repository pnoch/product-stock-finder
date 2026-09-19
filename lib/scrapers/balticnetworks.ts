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

  // `.productitem__price` is an ANCESTOR of `.price__current` and contains the
  // "Original price" compare-at text first, so including it made
  // parsePriceFromText return the pre-discount price. Use the current-price
  // element only.
  const $price = findPriceElement(
    $,
    ".price__current, [data-price-container]", 
    model,
  );
  if (!$price || $price.length === 0) return null;
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($price, model)) return null;

  const stockText = $(".productitem__stock, .stock, .availability")
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

export const balticnetworksParser: DistributorParser = {
  id: "balticnetworks-us",
  baseUrl: "https://balticnetworks.com",
  buildSearchUrl: (model) =>
    `https://balticnetworks.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html, model, url) => parseHtml(html, url ?? "https://balticnetworks.com", model),
  rateLimitMs: 3000,
};

export async function scrapeBalticNetworks(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = balticnetworksParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(
      url,
      balticnetworksParser.rateLimitMs,
    );
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

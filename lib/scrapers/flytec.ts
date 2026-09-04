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

  const $price = $("[data-product-price-without-tax], .price--withoutTax.price-primary, .price-section--withoutTax, .price").first();
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($price, model)) return null;

  const stockText = $(
    ".card-section--availability, .button--disabled, .stock-status",
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

export const flytecParser: DistributorParser = {
  id: "flytec-us",
  baseUrl: "https://flytechelectronics.com",
  buildSearchUrl: (model) =>
    `https://flytechelectronics.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html, model, url) => parseHtml(html, url ?? "https://flytechelectronics.com", model),
  rateLimitMs: 3000,
};

export async function scrapeFlytec(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = flytecParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, flytecParser.rateLimitMs);
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

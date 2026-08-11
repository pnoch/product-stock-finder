import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithRateLimit, parsePriceFromText, inferStockStatus } from "./utils";
import { getTaxRate } from "../tax";

function parseHtml(html: string, url: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const priceText = $("[data-product-price-without-tax], .price--withoutTax.price-primary, .price-section--withoutTax, .price").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(".card-section--availability, .button--disabled, .stock-status").first().text();
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
  parsePrice: (html) => parseHtml(html, "https://flytechelectronics.com"),
  rateLimitMs: 3000,
};

export async function scrapeFlytec(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = flytecParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, flytecParser.rateLimitMs);
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithRateLimit, parsePriceFromText, inferStockStatus } from "./utils";
import { getTaxRate } from "../tax";

function parseHtml(html: string, url: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const priceText = $(".price__current, [data-price-container], .productitem__price").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(".productitem__stock, .stock, .availability").first().text();
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
  parsePrice: (html) => parseHtml(html, "https://balticnetworks.com"),
  rateLimitMs: 3000,
};

export async function scrapeBalticNetworks(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = balticnetworksParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, balticnetworksParser.rateLimitMs);
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

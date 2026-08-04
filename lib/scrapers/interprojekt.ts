import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithRateLimit, parsePriceFromText, inferStockStatus } from "./utils";

function parseHtml(html: string, url: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const priceText = $(".price").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(".stock_status, .stock-status").first().text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "EUR",
    stockStatus,
    url,
  };
}

export const interprojektParser: DistributorParser = {
  id: "interprojekt-pl",
  baseUrl: "https://interprojekt.pl",
  buildSearchUrl: (model) =>
    `https://interprojekt.pl/en/catalogsearch/result/?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://interprojekt.pl"),
  rateLimitMs: 3000,
};

export async function scrapeInterprojekt(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = interprojektParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, interprojektParser.rateLimitMs);
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

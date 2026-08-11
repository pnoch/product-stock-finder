import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithRateLimit, parsePriceFromText, inferStockStatus } from "./utils";
import { getTaxRate } from "../tax";

function parseHtml(html: string, url: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const priceText = $(".prodprice, .product__price, .price").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(".prodinfo-stock-view-status, .product__stock, .stock").first().text();
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
  parsePrice: (html) => parseHtml(html, "https://linitx.com"),
  rateLimitMs: 3000,
};

export async function scrapeLinitx(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = linitxParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, linitxParser.rateLimitMs);
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

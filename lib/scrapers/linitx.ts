import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithRateLimit, parsePriceFromText, inferStockStatus } from "./utils";

function parseHtml(html: string, url: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const priceText = $(".product__price, .price--main, .price").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(".product__stock, .stock, .availability").first().text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "GBP",
    stockStatus,
    url,
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

import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithRateLimit, parsePriceFromText, inferStockStatus } from "./utils";

function parseHtml(html: string, url: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const priceText = $(".product-price, .price, [data-product-price]").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(".stock-status, .availability, .product-stock").first().text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "USD",
    stockStatus,
    url,
  };
}

export const linktechsParser: DistributorParser = {
  id: "linktechs-us",
  baseUrl: "https://linktechs.com",
  buildSearchUrl: (model) =>
    `https://linktechs.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://linktechs.com"),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-price, .price",
  },
};

export async function scrapeLinktechs(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = linktechsParser.buildSearchUrl(model);
    let html: string;
    if (linktechsParser.useBrowser) {
      const { fetchWithBrowser } = await import("@/lib/scrapers/browser");
      html = await fetchWithBrowser(url, linktechsParser.browserOptions);
    } else {
      html = await fetchWithRateLimit(url, linktechsParser.rateLimitMs);
    }
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

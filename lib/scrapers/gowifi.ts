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
    currency: "NZD",
    stockStatus,
    url,
  };
}

export const gowifiParser: DistributorParser = {
  id: "gowifi-nz",
  baseUrl: "https://gowifi.co.nz",
  buildSearchUrl: (model) =>
    `https://gowifi.co.nz/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://gowifi.co.nz"),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-price, .price",
  },
};

export async function scrapeGowifi(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = gowifiParser.buildSearchUrl(model);
    let html: string;
    if (gowifiParser.useBrowser) {
      const { fetchWithBrowser } = await import("@/lib/scrapers/browser");
      html = await fetchWithBrowser(url, gowifiParser.browserOptions);
    } else {
      html = await fetchWithRateLimit(url, gowifiParser.rateLimitMs);
    }
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

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
    currency: "EUR",
    stockStatus,
    url,
  };
}

export const hellascomParser: DistributorParser = {
  id: "hellascom-gr",
  baseUrl: "https://hellascom.gr",
  buildSearchUrl: (model) =>
    `https://hellascom.gr/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://hellascom.gr"),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-price, .price",
  },
};

export async function scrapeHellascom(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = hellascomParser.buildSearchUrl(model);
    let html: string;
    if (hellascomParser.useBrowser) {
      const { fetchWithBrowser } = await import("@/lib/scrapers/browser");
      html = await fetchWithBrowser(url, hellascomParser.browserOptions);
    } else {
      html = await fetchWithRateLimit(url, hellascomParser.rateLimitMs);
    }
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

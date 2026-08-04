import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithRateLimit, parsePriceFromText, inferStockStatus } from "./utils";

function parseHtml(html: string, url: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const priceText = $(".ac-price, .product-price, .price").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(".stock, .availability, .product-stock, .stock-status").first().text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "EUR",
    stockStatus,
    url,
  };
}

export const aerialParser: DistributorParser = {
  id: "aerial-gr",
  baseUrl: "https://aerial.net",
  buildSearchUrl: (model) =>
    `https://aerial.net/shop?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://aerial.net"),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".ac-price, .product-price",
  },
};

export async function scrapeAerial(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = aerialParser.buildSearchUrl(model);
    let html: string;
    if (aerialParser.useBrowser) {
      const { fetchWithBrowser } = await import("@/lib/scrapers/browser");
      html = await fetchWithBrowser(url, aerialParser.browserOptions);
    } else {
      html = await fetchWithRateLimit(url, aerialParser.rateLimitMs);
    }
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

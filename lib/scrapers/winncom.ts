import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithRateLimit, parsePriceFromText, inferStockStatus } from "./utils";

function parseHtml(html: string, url: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const priceText = $(".product-link, .nobr, td a[href*='/products/'], .price").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(".stock, .availability, .stock-status, td:contains('In Stock')").first().text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "USD",
    stockStatus,
    url,
  };
}

export const winncomParser: DistributorParser = {
  id: "winncom-us",
  baseUrl: "https://winncom.com",
  buildSearchUrl: (model) =>
    `https://winncom.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://winncom.com"),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".product-link, .price",
  },
};

export async function scrapeWinncom(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = winncomParser.buildSearchUrl(model);
    let html: string;
    if (winncomParser.useBrowser) {
      const { fetchWithBrowser } = await import("@/lib/scrapers/browser");
      html = await fetchWithBrowser(url, winncomParser.browserOptions);
    } else {
      html = await fetchWithRateLimit(url, winncomParser.rateLimitMs);
    }
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithRateLimit, parsePriceFromText, inferStockStatus } from "./utils";

function parseHtml(html: string, url: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const priceText = $(".price, [data-testid='price'], .product-price").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(".availability, .stock, [data-testid='availability'], .stock-status").first().text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "EUR",
    stockStatus,
    url,
  };
}

export const geticParser: DistributorParser = {
  id: "getic-gr",
  baseUrl: "https://getic.gr",
  buildSearchUrl: (model) =>
    `https://getic.gr/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://getic.gr"),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".price, [data-testid='price']",
  },
};

export async function scrapeGetic(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = geticParser.buildSearchUrl(model);
    let html: string;
    if (geticParser.useBrowser) {
      const { fetchWithBrowser } = await import("@/lib/scrapers/browser");
      html = await fetchWithBrowser(url, geticParser.browserOptions);
    } else {
      html = await fetchWithRateLimit(url, geticParser.rateLimitMs);
    }
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

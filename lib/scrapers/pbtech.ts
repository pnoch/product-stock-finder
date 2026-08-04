import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithRateLimit, parsePriceFromText, inferStockStatus } from "./utils";

function parseHtml(html: string, url: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const priceText = $(".price, .product-price, [data-product-price]").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(".stock, .availability, .product-stock, .stock-status").first().text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "NZD",
    stockStatus,
    url,
  };
}

export const pbtechParser: DistributorParser = {
  id: "pbtech-nz",
  baseUrl: "https://pbtech.co.nz",
  buildSearchUrl: (model) =>
    `https://pbtech.co.nz/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://pbtech.co.nz"),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".price, .product-price",
  },
};

export async function scrapePbtech(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = pbtechParser.buildSearchUrl(model);
    let html: string;
    if (pbtechParser.useBrowser) {
      const { fetchWithBrowser } = await import("@/lib/scrapers/browser");
      html = await fetchWithBrowser(url, pbtechParser.browserOptions);
    } else {
      html = await fetchWithRateLimit(url, pbtechParser.rateLimitMs);
    }
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

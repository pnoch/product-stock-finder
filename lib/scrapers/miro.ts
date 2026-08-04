import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithParser, parsePriceFromText, inferStockStatus } from "./utils";

function parseHtml(html: string, url: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const priceText = $(".product-price, .price, [data-price], [itemprop='price']").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(".availability, .stock, [itemprop='availability'], .stock-status").first().text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "ZAR",
    stockStatus,
    url,
  };
}

export const miroParser: DistributorParser = {
  id: "miro-za",
  baseUrl: "https://miro.co.za",
  buildSearchUrl: (model) =>
    `https://miro.co.za/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://miro.co.za"),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: "[itemprop='price']",
  },
};

export async function scrapeMiro(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = miroParser.buildSearchUrl(model);
    const html = await fetchWithParser(miroParser, url);
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

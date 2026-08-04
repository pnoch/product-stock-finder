import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithParser, parsePriceFromText, inferStockStatus } from "./utils";

function parseHtml(html: string, url: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const priceText = $(".price, [data-selenium='uppedDecimalPriceFirst'], .product-price").first().text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(".availability, .stock, [data-selenium='availability'], .stock-status").first().text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "USD",
    stockStatus,
    url,
  };
}

export const bhphotoParser: DistributorParser = {
  id: "bhphoto-us",
  baseUrl: "https://bhphotovideo.com",
  buildSearchUrl: (model) =>
    `https://bhphotovideo.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html) => parseHtml(html, "https://bhphotovideo.com"),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".price, [data-selenium]",
  },
};

export async function scrapeBhphoto(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = bhphotoParser.buildSearchUrl(model);
    const html = await fetchWithParser(bhphotoParser, url);
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

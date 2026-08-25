import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import {
  fetchWithParser,
  parsePriceFromText,
  inferStockStatus,
  modelMismatch,
} from "./utils";
import { getTaxRate } from "../tax";

function parseHtml(
  html: string,
  url: string,
  model?: string,
): ScrapeResult | null {
  const $ = cheerio.load(html);

  const $price = $(".price, [data-selenium='uppedDecimalPriceFirst'], .product-price").first();
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($price, model)) return null;

  const stockText = $(
    ".availability, .stock, [data-selenium='availability'], .stock-status",
  )
    .first()
    .text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "USD",
    stockStatus,
    url,
    taxRate: getTaxRate("United States"),
  };
}

export const bhphotoParser: DistributorParser = {
  id: "bhphoto-us",
  baseUrl: "https://bhphotovideo.com",
  buildSearchUrl: (model) =>
    `https://bhphotovideo.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html, model) => parseHtml(html, "https://bhphotovideo.com", model),
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
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

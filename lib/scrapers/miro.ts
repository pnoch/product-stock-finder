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

  const $price = $(".product-price, .price, [data-price], [itemprop='price']").first();
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($price, model)) return null;

  const stockText = $(
    ".availability, .stock, [itemprop='availability'], .stock-status",
  )
    .first()
    .text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "ZAR",
    stockStatus,
    url,
    taxRate: getTaxRate("South Africa"),
  };
}

export const miroParser: DistributorParser = {
  id: "miro-za",
  baseUrl: "https://miro.co.za",
  buildSearchUrl: (model) =>
    `https://miro.co.za/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html, model, url) => parseHtml(html, url ?? "https://miro.co.za", model),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: "[itemprop='price']",
  },
};

export async function scrapeMiro(model: string): Promise<ScrapeResult | null> {
  try {
    const url = miroParser.buildSearchUrl(model);
    const html = await fetchWithParser(miroParser, url);
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import { fetchWithParser, parsePriceFromText, inferStockStatus } from "./utils";
import { getTaxRate } from "../tax";

function parseHtml(html: string, url: string): ScrapeResult | null {
  const $ = cheerio.load(html);

  const priceText = $(".price, .product-price, [data-product-price]")
    .first()
    .text();
  const price = parsePriceFromText(priceText);
  if (!price) return null;

  const stockText = $(".stock, .availability, .product-stock, .stock-status")
    .first()
    .text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "NZD",
    stockStatus,
    url,
    taxRate: getTaxRate("New Zealand"),
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
    waitForSelector: ".price",
  },
};

export async function scrapePbtech(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = pbtechParser.buildSearchUrl(model);
    const html = await fetchWithParser(pbtechParser, url);
    return parseHtml(html, url);
  } catch {
    return null;
  }
}

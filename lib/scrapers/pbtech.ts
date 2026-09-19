import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import {
  fetchWithParser,
  parsePriceFromText,
  findPriceElement,
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

  const $price = findPriceElement(
    $,
    ".product-price, [data-product-price], .price",
    model,
  );
  if (!$price || $price.length === 0) return null;
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($price, model)) return null;

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
    `https://www.pbtech.co.nz/search?sf=${encodeURIComponent(model)}`,
  parsePrice: (html, model, url) => parseHtml(html, url ?? "https://pbtech.co.nz", model),
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
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

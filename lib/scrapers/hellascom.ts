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
    ".ty-grid-list__price, .ty-product-block__price-actual, .product-price, .price",
    model,
  );
  if (!$price || $price.length === 0) return null;
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($price, model)) return null;

  const card = $price.closest(".ty-grid-list__item, .ty-product-block");
  const stockText =
    card
      .find(
        ".block_avail_status_label .title b, .product_availability_status .title b",
      )
      .first()
      .text() ||
    $(".stock-status, .availability, .product-stock").first().text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "EUR",
    stockStatus,
    url,
    taxRate: getTaxRate("Greece"),
  };
}

export const hellascomParser: DistributorParser = {
  id: "hellascom-gr",
  baseUrl: "https://www.linkshop.gr",
  buildSearchUrl: (model) =>
    `https://www.linkshop.gr/?dispatch=products.search&q=${encodeURIComponent(model)}&search_performed=Y`,
  parsePrice: (html, model, url) =>
    parseHtml(html, url ?? "https://www.linkshop.gr", model),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".ty-grid-list__price, .ty-product-block__price-actual",
  },
};

export async function scrapeHellascom(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = hellascomParser.buildSearchUrl(model);
    const html = await fetchWithParser(hellascomParser, url);
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

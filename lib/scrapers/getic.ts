import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import {
  fetchWithParser,
  parsePriceFromText,
  inferStockStatus,
  matchesModel,
  modelMismatch,
} from "./utils";
import { getTaxRate } from "../tax";

function parseHtml(
  html: string,
  url: string,
  model?: string,
): ScrapeResult | null {
  const $ = cheerio.load(html);

  const $price = $(
    ".product-price-value, .price, [data-testid='price'], .product-price",
  ).first();
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (model) {
    // Card titles live in aria-label/alt attributes, not text nodes — join
    // every identifying signal before matching.
    const $card = $price.closest("[data-cy='product-card'], .shop-product-card");
    if ($card.length > 0) {
      const signals = [
        $card.attr("aria-label") ?? "",
        $card.find("[aria-label]").first().attr("aria-label") ?? "",
        $card.find("img[alt]").first().attr("alt") ?? "",
        $card.text(),
        $card.find("a[href]").first().attr("href") ?? "",
      ].join(" ");
      if (!matchesModel(signals, model)) return null;
    } else if (modelMismatch($price, model)) {
      return null;
    }
  }

  const stockText = $(
    ".stock-amount, .availability, .stock, [data-testid='availability'], .stock-status",
  )
    .first()
    .text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "EUR",
    stockStatus,
    url,
    taxRate: getTaxRate("Greece"),
  };
}

export const geticParser: DistributorParser = {
  id: "getic-gr",
  baseUrl: "https://getic.gr",
  buildSearchUrl: (model) =>
    `https://getic.gr/search?q=${encodeURIComponent(model)}`,
  parsePrice: (html, model, url) => parseHtml(html, url ?? "https://getic.gr", model),
  rateLimitMs: 3000,
  useBrowser: true,
  browserOptions: {
    waitForSelector: ".price",
  },
};

export async function scrapeGetic(model: string): Promise<ScrapeResult | null> {
  try {
    const url = geticParser.buildSearchUrl(model);
    const html = await fetchWithParser(geticParser, url);
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

import * as cheerio from "cheerio";
import { StockStatus } from "../types";
import { DistributorParser, ScrapeResult } from "./types";
import {
  fetchWithRateLimit,
  parsePriceFromText,
  findPriceElement,
  inferStockStatus,
  modelMismatch,
  matchesModel,
} from "./utils";
import { getTaxRate } from "../tax";

function parseMatrixTable(
  $: cheerio.CheerioAPI,
  model: string | undefined,
): ScrapeResult | null {
  if (!model) return null;
  let found: ScrapeResult | null = null;
  $("table.products-table").each((_, table) => {
    if (found) return;
    const $t = $(table);
    let targetCol = -1;
    $t.find("a.product-title").each((_, a) => {
      if (targetCol >= 0) return;
      if (matchesModel($(a).text(), model)) targetCol = $(a).closest("td").index();
    });
    if (targetCol < 0) return;
    $t.find("td.product-cell-price").each((_, td) => {
      if (found) return;
      const $td = $(td);
      if ($td.index() !== targetCol) return;
      const price = parsePriceFromText($td.find(".price").text() || $td.text());
      if (!price) return;
      const qty = $td.text().match(/quantity\s*=\s*(\d+)/);
      const stockStatus: StockStatus = qty
        ? Number(qty[1]) > 0
          ? "in_stock"
          : "out_of_stock"
        : inferStockStatus($td.text());
      found = {
        price,
        currency: "USD",
        stockStatus,
        url: "",
        taxRate: getTaxRate("United States"),
      };
    });
  });
  return found;
}

function parseHtml(
  html: string,
  url: string,
  model?: string,
): ScrapeResult | null {
  const $ = cheerio.load(html);

  const matrix = parseMatrixTable($, model);
  if (matrix) return { ...matrix, url };

  const $price = findPriceElement($, ".price, .product-price, td:contains('$')", model);
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
    currency: "USD",
    stockStatus,
    url,
    taxRate: getTaxRate("United States"),
  };
}

export const rocnocParser: DistributorParser = {
  id: "rocnoc-us",
  baseUrl: "https://www.roc-noc.com",
  buildSearchUrl: (model) =>
    `https://www.roc-noc.com/search.php?mode=search&substring=${encodeURIComponent(model)}`,
  parsePrice: (html, model, url) =>
    parseHtml(html, url ?? "https://www.roc-noc.com", model),
  // The storefront's search is JS-driven; plain HTML returns no results.
  useBrowser: true,
  rateLimitMs: 3000,
};

export async function scrapeRocnoc(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const url = rocnocParser.buildSearchUrl(model);
    const html = await fetchWithRateLimit(url, rocnocParser.rateLimitMs);
    return parseHtml(html, url, model);
  } catch {
    return null;
  }
}

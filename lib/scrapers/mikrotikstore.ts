import * as cheerio from "cheerio";
import { DistributorParser, ScrapeResult } from "./types";
import {
  fetchWithRateLimit,
  parsePriceFromText,
  inferStockStatus,
  modelMismatch,
} from "./utils";
import { getTaxRate } from "../tax";

// Search results are JS-rendered (the query is ignored server-side), so the
// reliable flow is: search page → extract matching product URL → product page.
function parseProductPage(
  html: string,
  url: string,
  model?: string,
): ScrapeResult | null {
  const $ = cheerio.load(html);

  const $price = $(".price-tag, .product-price, .product-detail-price, [itemprop='price']")
    .first();
  const price = parsePriceFromText($price.text());
  if (!price) return null;
  if (modelMismatch($price, model)) return null;

  const stockText = $(
    ".product-detail-delivery-status, .delivery-status, .availability, .stock-status",
  )
    .first()
    .text();
  const stockStatus = inferStockStatus(stockText);

  return {
    price,
    currency: "EUR",
    stockStatus,
    url,
    taxRate: getTaxRate("Germany"),
  };
}

function parseSearchResults(html: string, model?: string): string | null {
  if (!model) return null;
  const $ = cheerio.load(html);
  const wanted = model.toLowerCase().replace(/[^a-z0-9]/g, "");
  const modelTokens = wanted.match(/[a-z]+|\d+/g) ?? [];

  let best: string | null = null;
  let bestScore = 0;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || !/\/en\/(mikrotik-|.*switches\/)/.test(href)) return;
    const slug = href.split("/").pop() ?? "";
    const normalized = slug.replace(/[^a-z0-9]/g, "");
    const slugTokens = normalized.match(/[a-z]+|\d+/g) ?? [];
    const matched = modelTokens.filter((t) =>
      slugTokens.some(
        (s) =>
          s === t ||
          (t.length >= 2 && s.includes(t)) ||
          (s.length >= 2 && t.includes(s)),
      ),
    );
    const coverage = modelTokens.length
      ? matched.length / modelTokens.length
      : 0;
    // Search pages often only surface the category link (partial coverage);
    // category pages carry the full product links. Accept ≥2/5 token match
    // on the model core (crs326) so the category hop can happen — the
    // product page re-verifies the model anyway.
    if (coverage >= 0.4) {
      const score = coverage * 1000 + normalized.length;
      if (score > bestScore) {
        best = href;
        bestScore = score;
      }
    }
  });
  return best;
}

function buildMikrotikSearchUrl(model: string): string {
  return `https://mikrotik-store.eu/en/search?q=${encodeURIComponent(model)}`;
}

export const mikrotikstoreParser: DistributorParser = {
  id: "mikrotikstore-de",
  baseUrl: "https://mikrotik-store.eu",
  buildSearchUrl: buildMikrotikSearchUrl,
  parsePrice: (html, model) =>
    parseProductPage(
      html,
      model ? buildMikrotikSearchUrl(model) : "https://mikrotik-store.eu",
      model,
    ),
  rateLimitMs: 3000,
};

export async function scrapeMikrotikStore(
  model: string,
): Promise<ScrapeResult | null> {
  try {
    const searchUrl = mikrotikstoreParser.buildSearchUrl(model);
    let url = parseSearchResults(
      await fetchWithRateLimit(searchUrl, mikrotikstoreParser.rateLimitMs),
      model,
    );
    // Search may land on a category page — follow one more hop to find the
    // full-coverage product link there.
    if (url && !isProductPage(url)) {
      const catHtml = await fetchWithRateLimit(url, mikrotikstoreParser.rateLimitMs);
      const productLink = parseSearchResults(catHtml, model);
      if (productLink) url = productLink;
    }
    if (!url) return null;
    const productHtml = await fetchWithRateLimit(
      url,
      mikrotikstoreParser.rateLimitMs,
    );
    return parseProductPage(productHtml, url, model);
  } catch {
    return null;
  }
}

// Category pages live under /en/switches/<category>; product pages are
// /en/mikrotik-<slug> or /en/<category>/<product-slug>.
function isProductPage(url: string): boolean {
  return /\/en\/mikrotik-/.test(url);
}
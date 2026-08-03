import { DistributorParser, ScrapeResult } from "./types";

export const rocnocParser: DistributorParser = {
  id: "rocnoc-us",
  baseUrl: "https://roc-noc.com",
  buildSearchUrl: (model) =>
    `https://roc-noc.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeRocnoc(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

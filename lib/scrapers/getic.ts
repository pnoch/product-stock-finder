import { DistributorParser, ScrapeResult } from "./types";

export const geticParser: DistributorParser = {
  id: "getic-gr",
  baseUrl: "https://getic.com",
  buildSearchUrl: (model) =>
    `https://getic.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeGetic(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

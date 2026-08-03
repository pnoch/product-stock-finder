import { DistributorParser, ScrapeResult } from "./types";

export const aerialParser: DistributorParser = {
  id: "aerial-gr",
  baseUrl: "https://aerial.net",
  buildSearchUrl: (model) =>
    `https://aerial.net/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeAerial(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

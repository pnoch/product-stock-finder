import { DistributorParser, ScrapeResult } from "./types";

export const neobitsParser: DistributorParser = {
  id: "neobits-us",
  baseUrl: "https://neobits.com",
  buildSearchUrl: (model) =>
    `https://neobits.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeNeobits(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

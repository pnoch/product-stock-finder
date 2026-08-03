import { DistributorParser, ScrapeResult } from "./types";

export const nasstoreParser: DistributorParser = {
  id: "nasstore-eu",
  baseUrl: "https://nasstore.eu",
  buildSearchUrl: (model) =>
    `https://nasstore.eu/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeNasstore(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

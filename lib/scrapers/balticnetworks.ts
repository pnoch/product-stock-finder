import { DistributorParser, ScrapeResult } from "./types";

export const balticnetworksParser: DistributorParser = {
  id: "balticnetworks-us",
  baseUrl: "https://balticnetworks.com",
  buildSearchUrl: (model) =>
    `https://balticnetworks.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeBalticnetworks(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

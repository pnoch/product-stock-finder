import { DistributorParser, ScrapeResult } from "./types";

export const server2uParser: DistributorParser = {
  id: "server2u-my",
  baseUrl: "https://server2u.com",
  buildSearchUrl: (model) =>
    `https://server2u.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeServer2U(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

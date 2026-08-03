import { DistributorParser, ScrapeResult } from "./types";

export const flytecParser: DistributorParser = {
  id: "flytec-us",
  baseUrl: "https://flyteccomputers.com",
  buildSearchUrl: (model) =>
    `https://flyteccomputers.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeFlytec(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

import { DistributorParser, ScrapeResult } from "./types";

export const mbsiwavParser: DistributorParser = {
  id: "mbsiwav-ca",
  baseUrl: "https://mbsiwav.com",
  buildSearchUrl: (model) =>
    `https://mbsiwav.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeMbsiwav(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

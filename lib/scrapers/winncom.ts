import { DistributorParser, ScrapeResult } from "./types";

export const winncomParser: DistributorParser = {
  id: "winncom-us",
  baseUrl: "https://winncom.com",
  buildSearchUrl: (model) =>
    `https://winncom.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeWinncom(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

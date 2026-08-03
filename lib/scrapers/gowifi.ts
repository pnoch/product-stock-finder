import { DistributorParser, ScrapeResult } from "./types";

export const gowifiParser: DistributorParser = {
  id: "gowifi-nz",
  baseUrl: "https://gowifi.co.nz",
  buildSearchUrl: (model) =>
    `https://gowifi.co.nz/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeGowifi(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

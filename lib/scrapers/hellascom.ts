import { DistributorParser, ScrapeResult } from "./types";

export const hellascomParser: DistributorParser = {
  id: "hellascom-gr",
  baseUrl: "https://hellascom.gr",
  buildSearchUrl: (model) =>
    `https://hellascom.gr/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeHellascom(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

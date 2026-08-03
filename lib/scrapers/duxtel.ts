import { DistributorParser, ScrapeResult } from "./types";

export const duxtelParser: DistributorParser = {
  id: "duxtel-au",
  baseUrl: "https://store.duxtel.com",
  buildSearchUrl: (model) =>
    `https://store.duxtel.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeDuxtel(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

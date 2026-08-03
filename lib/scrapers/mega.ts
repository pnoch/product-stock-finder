import { DistributorParser, ScrapeResult } from "./types";

export const megaParser: DistributorParser = {
  id: "100mega-cz",
  baseUrl: "https://b2b.100mega.com",
  buildSearchUrl: (model) =>
    `https://b2b.100mega.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeMega(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

import { DistributorParser, ScrapeResult } from "./types";

export const linktechsParser: DistributorParser = {
  id: "linktechs-us",
  baseUrl: "https://shop.linktechs.net",
  buildSearchUrl: (model) =>
    `https://shop.linktechs.net/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeLinktechs(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

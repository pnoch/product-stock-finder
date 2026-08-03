import { DistributorParser, ScrapeResult } from "./types";

export const multilinkParser: DistributorParser = {
  id: "multilink-us",
  baseUrl: "https://shop.multilink.us",
  buildSearchUrl: (model) =>
    `https://shop.multilink.us/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeMultilink(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

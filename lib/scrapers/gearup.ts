import { DistributorParser, ScrapeResult } from "./types";

export const gearupParser: DistributorParser = {
  id: "gearup-ae",
  baseUrl: "https://gear-up.me",
  buildSearchUrl: (model) =>
    `https://gear-up.me/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeGearup(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

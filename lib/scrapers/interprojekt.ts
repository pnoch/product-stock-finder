import { DistributorParser, ScrapeResult } from "./types";

export const interprojektParser: DistributorParser = {
  id: "interprojekt-pl",
  baseUrl: "https://interprojekt.pl",
  buildSearchUrl: (model) =>
    `https://interprojekt.pl/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeInterprojekt(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

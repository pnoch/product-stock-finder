import { DistributorParser, ScrapeResult } from "./types";

export const miroParser: DistributorParser = {
  id: "miro-za",
  baseUrl: "https://miro.co.za",
  buildSearchUrl: (model) =>
    `https://miro.co.za/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeMiro(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

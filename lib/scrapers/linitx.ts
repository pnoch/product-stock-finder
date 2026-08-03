import { DistributorParser, ScrapeResult } from "./types";

export const linitxParser: DistributorParser = {
  id: "linitx-uk",
  baseUrl: "https://linitx.com",
  buildSearchUrl: (model) =>
    `https://linitx.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeLinitx(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

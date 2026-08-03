import { DistributorParser, ScrapeResult } from "./types";

export const pbtechParser: DistributorParser = {
  id: "pbtech-nz",
  baseUrl: "https://pbtech.co.nz",
  buildSearchUrl: (model) =>
    `https://pbtech.co.nz/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapePbtech(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

import { DistributorParser, ScrapeResult } from "./types";

export const wispParser: DistributorParser = {
  id: "wisp-au",
  baseUrl: "https://wisp.net.au",
  buildSearchUrl: (model) =>
    `https://wisp.net.au/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeWisp(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

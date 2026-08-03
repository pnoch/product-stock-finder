import { DistributorParser, ScrapeResult } from "./types";

export const mikrotikstoreParser: DistributorParser = {
  id: "mikrotikstore-de",
  baseUrl: "https://mikrotik-store.eu",
  buildSearchUrl: (model) =>
    `https://mikrotik-store.eu/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeMikrotikstore(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

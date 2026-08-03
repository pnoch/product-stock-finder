import { DistributorParser, ScrapeResult } from "./types";

export const networkdevicesParser: DistributorParser = {
  id: "networkdevices-us",
  baseUrl: "https://networkdevicesinc.com",
  buildSearchUrl: (model) =>
    `https://networkdevicesinc.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeNetworkdevices(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

import { DistributorParser, ScrapeResult } from "./types";

export const bhphotoParser: DistributorParser = {
  id: "bhphoto-us",
  baseUrl: "https://bhphotovideo.com",
  buildSearchUrl: (model) =>
    `https://bhphotovideo.com/search?q=${encodeURIComponent(model)}`,
  parsePrice: () => null,
  rateLimitMs: 2000,
};

export async function scrapeBhphoto(
  _model: string,
): Promise<ScrapeResult | null> {
  return null;
}

// Server-only managed scraping-provider fallback. Configured entirely by env:
//   SCRAPING_PROVIDER_URL        URL template containing {url}
//   SCRAPING_PROVIDER_API_KEY    optional bearer token
//   SCRAPING_PROVIDER_KEY_HEADER optional header name (default Authorization)
// Unset URL => no fetcher registered => the provider method is unavailable.
import { setProviderFetcher } from "../../lib/scrapers/resilient";
import { tryConsumeBudget } from "../spend-budget";

export function registerScrapingProvider(): boolean {
  const template = process.env.SCRAPING_PROVIDER_URL;
  if (!template) {
    setProviderFetcher(null);
    return false;
  }
  const key = process.env.SCRAPING_PROVIDER_API_KEY;
  const keyHeader = process.env.SCRAPING_PROVIDER_KEY_HEADER ?? "Authorization";

  setProviderFetcher(async (url: string): Promise<string | null> => {
    if (!tryConsumeBudget("scraping.provider")) return null;
    const target = template.replace("{url}", encodeURIComponent(url));
    const headers: Record<string, string> = {};
    if (key) headers[keyHeader] = keyHeader === "Authorization" ? `Bearer ${key}` : key;
    try {
      const res = await fetch(target, { headers });
      if (!res.ok) return null;
      return await res.text();
    } catch {
      return null;
    }
  });
  return true;
}

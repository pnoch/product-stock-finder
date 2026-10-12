export interface FbSearchListing {
  itemId: string;
  title: string;
  price: number | null;
  currency: "THB" | null;
  location: string | null;
  url: string;
}

export function buildFbSearchUrl(input: { query: string; location: string; radiusKm: number }): string {
  const params = new URLSearchParams({ query: input.query.trim() });
  if (input.location.trim()) params.set("location", input.location.trim());
  params.set("radius", String(input.radiusKm));
  return `https://www.facebook.com/marketplace/search/?${params.toString().replace(/\+/g, "%20")}`;
}

const ITEM_LINK = /href="\/marketplace\/item\/([1-9]\d{0,19})\/[^"]*"/g;
const PRICE_NEAR = /"listing_price":\{"amount":"([\d,]+(?:\.\d{1,2})?)"\},"formatted_price":\{"text":"(?:\\u0e3f|฿)/;
const MAX_RESULTS = 20;

export function extractFbSearchResults(html: string): FbSearchListing[] {
  const out: FbSearchListing[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(ITEM_LINK)) {
    const itemId = m[1]!;
    if (seen.has(itemId)) continue;
    seen.add(itemId);
    const start = Math.max(0, (m.index ?? 0) - 200);
    const window = html.slice(start, (m.index ?? 0) + 2000);
    const title =
      window.match(/>\s*([^<>]{1,200}?)\s*<\/a>/)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
    const priceMatch = window.match(PRICE_NEAR);
    const price = priceMatch ? Number(priceMatch[1]!.replace(/,/g, "")) : null;
    const location = window.match(/>\s*([A-Za-zก-๙][^<>]{1,60}?)\s*<\/span>\s*<\/div>/)?.[1]?.trim() ?? null;
    out.push({
      itemId,
      title,
      price: price && Number.isFinite(price) && price > 0 ? price : null,
      currency: price ? "THB" : null,
      location,
      url: `https://www.facebook.com/marketplace/item/${itemId}/`,
    });
    if (out.length >= MAX_RESULTS) break;
  }
  return out;
}

export type FbSearchState =
  | { kind: "listings"; listings: FbSearchListing[] }
  | { kind: "login_required" }
  | { kind: "unavailable" }
  | { kind: "empty" };

export async function searchFbMarketplace(input: {
  query: string; location: string; radiusKm: number;
  loadHtml?: (url: string) => Promise<string>;
}): Promise<FbSearchState> {
  const loadHtml = input.loadHtml ?? (async (url: string) => {
    const { getWebViewHost } = await import("../scrapers/webview-host");
    const host = getWebViewHost();
    if (!host) throw new Error("unavailable");
    return host.load(url, { timeoutMs: 25000 });
  });
  let html: string;
  try {
    html = await loadHtml(buildFbSearchUrl(input));
  } catch {
    return { kind: "unavailable" };
  }
  if (/log in or sign up|you must log in|log in to continue|Forgotten password\?/i.test(html.slice(0, 6000))) {
    return { kind: "login_required" };
  }
  const listings = extractFbSearchResults(html);
  return listings.length > 0 ? { kind: "listings", listings } : { kind: "empty" };
}

import * as cheerio from "cheerio";
import { z } from "zod";
import { EBAY_SEARCH_LIMIT, type EbaySearchListing, type EbaySearchResult } from "../shared/ebay-search";

const Money = z.object({ value: z.string(), currency: z.string().regex(/^[A-Z]{3}$/) });
const SearchResponse = z.object({
  total: z.number().nonnegative().optional(),
  itemSummaries: z.array(z.object({
    itemWebUrl: z.string(), title: z.string(),
    price: Money.optional(), condition: z.string().optional(),
    image: z.object({ imageUrl: z.string() }).optional(),
    seller: z.object({ username: z.string() }).optional(),
    shippingOptions: z.array(z.object({ shippingCost: Money.optional() })).optional(),
  })).optional(),
});

function itemIdentity(raw: string): { itemId: string; url: string } | null {
  try {
    const url = new URL(raw, "https://www.ebay.com");
    if (url.protocol !== "https:" || url.username || url.password || url.port || !["www.ebay.com", "ebay.com"].includes(url.hostname)) return null;
    if (url.searchParams.get("var")) return null;
    const match = url.pathname.match(/^\/itm\/(?:[^/]+\/)?([1-9]\d{0,19})\/?$/);
    const itemId = match?.[1];
    return itemId ? { itemId, url: `https://www.ebay.com/itm/${itemId}` } : null;
  } catch { return null; }
}

function imageUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && (url.hostname === "i.ebayimg.com" || url.hostname.endsWith(".ebayimg.com")) ? url.href : null;
  } catch { return null; }
}

export function mapEbaySearchResponse(raw: unknown): EbaySearchResult {
  const parsed = SearchResponse.safeParse(raw);
  if (!parsed.success) return { kind: "unavailable", reason: "unreadable" };
  const listings: EbaySearchListing[] = [];
  const seen = new Set<string>();
  for (const item of parsed.data.itemSummaries ?? []) {
    const identity = itemIdentity(item.itemWebUrl);
    if (!identity || seen.has(identity.itemId) || !item.title.trim()) continue;
    seen.add(identity.itemId);
    const price = Number(item.price?.value);
    const shipping = item.shippingOptions?.[0]?.shippingCost;
    listings.push({ ...identity, title: item.title.trim(), imageUrl: imageUrl(item.image?.imageUrl),
      price: Number.isFinite(price) && price > 0 ? price : null,
      currency: Number.isFinite(price) && price > 0 ? item.price?.currency ?? null : null,
      condition: item.condition ?? null, seller: item.seller?.username ?? null,
      shipping: shipping ? `${shipping.value} ${shipping.currency}` : null });
    if (listings.length === EBAY_SEARCH_LIMIT) break;
  }
  if (listings.length) return { kind: "results", source: "api", listings };
  return parsed.data.total === 0 ? { kind: "empty", source: "api" } : { kind: "unavailable", reason: "unreadable" };
}

export function parseEbaySearchPage(html: string): EbaySearchResult {
  const $ = cheerio.load(html);
  if (/pardon our interruption|verify you're human|access denied|error page/i.test($("title").text()) || $("#captcha_form, #challenge-form").length) return { kind: "unavailable", reason: "blocked" };
  const listings: EbaySearchListing[] = [];
  const seen = new Set<string>();
  $(".s-card, .s-item").each((_index, node) => {
    if (listings.length >= EBAY_SEARCH_LIMIT) return;
    const card = $(node);
    const title = card
      .find(".s-card__title, .s-item__title")
      .first()
      .text()
      .replace(/Opens in a new window or tab/gi, "")
      .replace(/^(?:New Listing|SPONSORED|Sponsored)\s*/i, "")
      .trim();
    if (!title || /^shop on ebay$/i.test(title)) return;
    const identity = itemIdentity(card.find('a[href*="/itm/"]').first().attr("href") ?? "");
    if (!identity || seen.has(identity.itemId)) return;
    seen.add(identity.itemId);
    const text = card.find(".s-card__price, .s-item__price").first().text().trim();
    const priceMatch = text.match(/^(US\s*\$|USD|THB|฿)\s*([\d,]+(?:\.\d{1,2})?)$/);
    const amount = priceMatch ? Number(priceMatch[2]?.replace(/,/g, "")) : NaN;
    const price = Number.isFinite(amount) && amount > 0 ? amount : null;
    const currency = price === null ? null : /^US|USD/.test(priceMatch?.[1] ?? "") ? "USD" : "THB";
    const attributes = card.find(".s-card__attribute-row, .s-card__subtitle, .s-card__footer--row, .s-item__subtitle .SECONDARY_INFO").map((_i, element) => $(element).text().trim()).get();
    const condition = attributes.find((text) => /^(brand new|new|pre-owned|used|open box|refurbished|for parts or not working)$/i.test(text)) ?? null;
    const shipping = card.find(".s-card__shipping, .s-item__shipping, .s-item__logisticsCost").first().text().trim() || attributes.find((text) => /^(?:\+)?(?:THB|US\s*\$|USD|฿)[\d,.\s]+(?:delivery|shipping)\b|^free (?:delivery|shipping)\b/i.test(text)) || null;
    const seller = card.find(".s-card__seller, .s-item__seller-info-text").first().text().trim() || attributes.find((text) => /\d+(?:\.\d+)?% positive/i.test(text)) || null;
    listings.push({ ...identity, title, price, currency,
      imageUrl: imageUrl(card.find("img").first().attr("src")),
      condition, seller, shipping });
  });
  if (listings.length) return { kind: "results", source: "browser", listings };
  const noResults = $(".srp-save-null-search, .srp-river-results--null, .srp-controls__count-heading").text();
  return /(?:\b0 results\b|no results found|no exact matches found)/i.test(noResults)
    ? { kind: "empty", source: "browser" } : { kind: "unavailable", reason: "unreadable" };
}

interface Dependencies {
  fetch: typeof fetch;
  render: (url: string) => Promise<string>;
  clientId?: string;
  clientSecret?: string;
}

export function createEbaySearch(deps: Dependencies) {
  let token: { value: string; until: number } | null = null;
  let tokenPending: Promise<string> | null = null;
  const cache = new Map<string, { result: EbaySearchResult; until: number }>();
  const pending = new Map<string, Promise<EbaySearchResult>>();
  let active = 0;

  async function accessToken(): Promise<string> {
    if (token && token.until > Date.now()) return token.value;
    if (tokenPending) return tokenPending;
    tokenPending = (async () => {
      const res = await deps.fetch("https://api.ebay.com/identity/v1/oauth2/token", {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Basic ${Buffer.from(`${deps.clientId}:${deps.clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "client_credentials", scope: "https://api.ebay.com/oauth/api_scope" }).toString(),
      });
      if (!res.ok) throw new Error("credentials");
      const body = z.object({ access_token: z.string().min(1), expires_in: z.number().positive() }).parse(await res.json());
      token = { value: body.access_token, until: Date.now() + Math.max(0, body.expires_in - 60) * 1000 };
      return body.access_token;
    })();
    try { return await tokenPending; } finally { tokenPending = null; }
  }

  async function run(query: string): Promise<EbaySearchResult> {
    if (deps.clientId && deps.clientSecret) {
      try {
        const bearer = await accessToken();
        const params = new URLSearchParams({ q: query, limit: String(EBAY_SEARCH_LIMIT) });
        const res = await deps.fetch(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`, {
          redirect: "error", signal: AbortSignal.timeout(15000),
          headers: { Authorization: `Bearer ${bearer}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" },
        });
        if (res.status === 401) token = null;
        if (res.ok) {
          const result = mapEbaySearchResponse(await res.json());
          if (result.kind !== "unavailable") return result;
        }
      } catch { /* Public browser fallback does not use account credentials. */ }
    }
    try {
      const params = new URLSearchParams({ _nkw: query, _ipg: "25" });
      return parseEbaySearchPage(await deps.render(`https://www.ebay.com/sch/i.html?${params}`));
    } catch { return { kind: "unavailable", reason: "network" }; }
  }

  return async (rawQuery: string): Promise<EbaySearchResult> => {
    const query = rawQuery.trim();
    const key = query.toLowerCase();
    const hit = cache.get(key);
    if (hit && hit.until > Date.now()) return hit.result;
    const existing = pending.get(key);
    if (existing) return existing;
    if (active >= 2) return { kind: "unavailable", reason: "busy" };
    active++;
    const operation = run(query).then((result) => {
      if (result.kind !== "unavailable") {
        if (cache.size >= 100) cache.delete(cache.keys().next().value ?? "");
        cache.set(key, { result, until: Date.now() + 300000 });
      }
      return result;
    }).finally(() => { active--; pending.delete(key); });
    pending.set(key, operation);
    return operation;
  };
}

export const searchEbay = createEbaySearch({
  fetch: (...args) => fetch(...args),
  clientId: process.env.EBAY_CLIENT_ID,
  clientSecret: process.env.EBAY_CLIENT_SECRET,
  render: async (url) => {
    const { fetchWithBrowser } = await import("../lib/scrapers/browser");
    return fetchWithBrowser(url, { timeoutMs: 20000, waitForSelector: ".s-card, .s-item", publicSession: true });
  },
});

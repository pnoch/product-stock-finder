import { describe, expect, it, vi } from "vitest";
import { createEbaySearch, mapEbaySearchResponse, parseEbaySearchPage } from "../server/ebay-search";

const card = (id: string, title: string, price = "US $1,200.00") => `<li class="s-card"><a href="https://www.ebay.com/itm/${id}?tracking=x"><div class="s-card__title">${title}</div><img src="https://i.ebayimg.com/a.jpg"></a><span class="s-card__price">${price}</span><div class="s-card__subtitle">Brand New</div></li>`;
const page = `<html><title>RTX5090 for sale | eBay</title><ul>${card("123456", "Shop on eBay")}${card("178212205608", "RTX5090")}${card("987654321", "RTX5090 used", "THB65,000.00")}</ul></html>`;
const apiResult = { total: 1, itemSummaries: [{ itemWebUrl: "https://www.ebay.com/itm/178212205608?x=y", title: "RTX5090", price: { value: "1200.00", currency: "USD" }, seller: { username: "seller" }, condition: "New", image: { imageUrl: "https://i.ebayimg.com/a.jpg" } }] };

describe("eBay search normalization", () => {
  it("isolates listing data and removes placeholder cards", () => {
    const result = parseEbaySearchPage(page);
    expect(result.kind).toBe("results");
    if (result.kind !== "results") throw new Error("missing results");
    expect(result.listings).toHaveLength(2);
    expect(result.listings[0]).toMatchObject({ itemId: "178212205608", price: 1200, currency: "USD", title: "RTX5090" });
    expect(result.listings[1]).toMatchObject({ itemId: "987654321", price: 65000, currency: "THB" });
    expect(result.listings[0]?.url).toBe("https://www.ebay.com/itm/178212205608");
  });

  it("strips listing badges and reads condition/seller from attribute rows", () => {
    const html = `<li class="s-card"><a href="https://www.ebay.com/itm/178212205608"><div class="s-card__title">New ListingRTX5090</div></a><span class="s-card__price">THB65,000.00</span><div class="s-card__attribute-row"><span>Brand New</span></div><div class="s-card__footer--row"><span>seller 99.8% positive (26.8K)</span></div></li>`;
    const result = parseEbaySearchPage(html);
    if (result.kind !== "results") throw new Error("missing results");
    expect(result.listings[0]).toMatchObject({ title: "RTX5090", condition: "Brand New", seller: "seller 99.8% positive (26.8K)" });
  });

  it("does not guess a currency for dollar-only prices or a range", () => {
    const result = parseEbaySearchPage(card("178212205608", "Card", "$900.00 to $1,200.00"));
    expect(result.kind).toBe("results");
    if (result.kind === "results") expect(result.listings[0]).toMatchObject({ price: null, currency: null });
  });

  it("deduplicates and rejects foreign links and variation selectors", () => {
    const result = parseEbaySearchPage(`${page}${card("178212205608", "duplicate")}${card("999", "unsafe").replace("www.ebay.com", "www.ebay.com.evil.test")}${card("888", "variant").replace("tracking=x", "var=123")}`);
    if (result.kind !== "results") throw new Error("missing results");
    expect(result.listings).toHaveLength(2);
  });

  it("distinguishes verified empty results, blocked pages, and unreadable HTML", () => {
    expect(parseEbaySearchPage('<h1 class="srp-controls__count-heading">0 results</h1>')).toEqual({ kind: "empty", source: "browser" });
    expect(parseEbaySearchPage("<title>Pardon our interruption</title>")).toEqual({ kind: "unavailable", reason: "blocked" });
    expect(parseEbaySearchPage("<html>unexpected markup</html>")).toEqual({ kind: "unavailable", reason: "unreadable" });
  });

  it("maps API offers and preserves original currency", () => {
    expect(mapEbaySearchResponse(apiResult)).toMatchObject({ kind: "results", source: "api", listings: [{ itemId: "178212205608", price: 1200, currency: "USD", seller: "seller" }] });
    expect(mapEbaySearchResponse({ total: 0 })).toEqual({ kind: "empty", source: "api" });
    expect(mapEbaySearchResponse({ errors: [{ message: "denied" }] })).toEqual({ kind: "unavailable", reason: "unreadable" });
  });
});

describe("eBay provider", () => {
  it("uses browser fallback without credentials, coalesces requests, and caches results", async () => {
    const render = vi.fn(async (_url: string) => page);
    const fetcher = vi.fn();
    const search = createEbaySearch({ fetch: async () => { fetcher(); throw new Error("unexpected fetch"); }, render });
    const [a, b] = await Promise.all([search("rtx5090"), search("rtx5090")]);
    expect(a).toEqual(b);
    expect(render).toHaveBeenCalledTimes(1);
    expect(fetcher).not.toHaveBeenCalled();
    await search("RTX5090");
    expect(render).toHaveBeenCalledTimes(1);
    const url = new URL(render.mock.calls[0]?.[0] ?? "");
    expect(url.origin).toBe("https://www.ebay.com");
    expect(url.searchParams.get("_nkw")).toBe("rtx5090");
  });

  it("keeps hostile query text in a query parameter", async () => {
    const render = vi.fn(async (_url: string) => page);
    await createEbaySearch({ fetch, render })("https://localhost/private&redirect=evil");
    const url = new URL(render.mock.calls[0]?.[0] ?? "");
    expect(url.hostname).toBe("www.ebay.com");
    expect(url.searchParams.get("_nkw")).toBe("https://localhost/private&redirect=evil");
    expect(url.searchParams.has("redirect")).toBe(false);
  });

  it("uses server-only OAuth and reuses its token for different queries", async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input);
      requests.push({ url, init });
      return Response.json(url.endsWith("/token") ? { access_token: "test-token", expires_in: 7200 } : apiResult);
    };
    const render = vi.fn(async (_url: string) => page);
    const search = createEbaySearch({ fetch: fetcher, render, clientId: "test-id", clientSecret: "test-secret" });
    expect((await search("gpu")).kind).toBe("results");
    await search("router");
    expect(requests.filter((request) => request.url.endsWith("/token"))).toHaveLength(1);
    expect(requests[1]?.init?.headers).toMatchObject({ Authorization: "Bearer test-token", "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" });
    expect(render).not.toHaveBeenCalled();
  });

  it("falls back on rejected API credentials and never reports an outage as empty", async () => {
    const fetcher: typeof fetch = async () => new Response("denied", { status: 403 });
    const search = createEbaySearch({ fetch: fetcher, render: async () => { throw new Error("blocked"); }, clientId: "test-id", clientSecret: "test-secret" });
    expect(await search("gpu")).toEqual({ kind: "unavailable", reason: "network" });
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveMarketplaceLink } from "../server/marketplace-resolver";
import { parseProductText, resolvePublicAddresses } from "../server/product-parse";
import { MARKETPLACE_REDIRECT_LIMIT } from "../shared/const";

const dns = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({ lookup: dns }));
const short = "https://s.shopee.co.th/9pf1T7VwV7";
const product = "https://shopee.co.th/opaanlp/1950119/28177881956?utm_source=share";
const publicAddresses = [{ address: "1.1.1.1", family: 4 }];
function boundary(locations: string[]) {
  return {
    resolvePublicAddresses: vi.fn(async () => publicAddresses),
    fetchPinned: vi.fn(async () => new Response(null, { status: 302, headers: { location: locations.shift() ?? product } })),
  };
}
afterEach(() => vi.useRealTimers());
describe("safe marketplace resolver", () => {
  it("follows only manual redirects with DNS pinning and canonicalizes the final product", async () => {
    const deps = boundary(["https://th.shp.ee/abc", product]);
    const result = await resolveMarketplaceLink(short, deps);
    expect(result).toMatchObject({ kind: "product", identity: { shopId: "1950119", itemId: "28177881956", canonicalUrl: "https://shopee.co.th/product/1950119/28177881956" } });
    expect(deps.resolvePublicAddresses.mock.calls).toHaveLength(2);
    expect(deps.fetchPinned).toHaveBeenCalledWith(short, expect.objectContaining({ redirect: "manual", signal: expect.any(AbortSignal) }), publicAddresses);
  });
  it.each(["https://evil.example/", "http://th.shp.ee/a", "https://user@th.shp.ee/a", "https://th.shp.ee:8443/a", "https://shopee.co.th.evil.example/product/1/2", "https://127.0.0.1/"])("blocks redirect to %s before DNS or fetch", async (location) => {
    const deps = boundary([location]);
    expect(await resolveMarketplaceLink(short, deps)).toEqual({ kind: "blocked", reason: "url" });
    expect(deps.fetchPinned).toHaveBeenCalledTimes(1);
    expect(deps.resolvePublicAddresses).toHaveBeenCalledTimes(1);
  });
  it("doesn't fetch arbitrary initial hosts", async () => {
    const deps = boundary([]);
    expect(await resolveMarketplaceLink("https://example.com/", deps)).toEqual({ kind: "blocked", reason: "url" });
    expect(deps.fetchPinned).not.toHaveBeenCalled();
  });
  it("returns unsupported for livestream without fetching the session", async () => {
    const deps = boundary(["https://live.shopee.co.th/share?session=123"]);
    expect(await resolveMarketplaceLink(short, deps)).toEqual({ kind: "unsupported", reason: "livestream" });
    expect(deps.fetchPinned).toHaveBeenCalledTimes(1);
  });
  it("bounds hops and detects loops", async () => {
    const deps = boundary(Array.from({ length: 10 }, (_, i) => `https://th.shp.ee/a${i}`));
    expect(await resolveMarketplaceLink(short, deps)).toEqual({ kind: "blocked", reason: "redirect_limit" });
    expect(deps.fetchPinned).toHaveBeenCalledTimes(MARKETPLACE_REDIRECT_LIMIT);
    expect(await resolveMarketplaceLink(short, boundary([short]))).toEqual({ kind: "blocked", reason: "redirect_loop" });
  });
  it("rejects mixed public/private DNS answers using the real SSRF boundary", async () => {
    dns.mockResolvedValue([{ address: "1.1.1.1", family: 4 }, { address: "127.0.0.1", family: 4 }]);
    const fetchPinned = vi.fn();
    expect(await resolveMarketplaceLink(short, { resolvePublicAddresses, fetchPinned })).toEqual({ kind: "blocked", reason: "dns" });
    expect(fetchPinned).not.toHaveBeenCalled();
  });
  it("returns an explicit error for non-redirect responses and network failures", async () => {
    const deps = boundary([]);
    deps.fetchPinned.mockImplementation(async () => new Response(null, { status: 403 }));
    expect(await resolveMarketplaceLink(short, deps)).toEqual({ kind: "error", reason: "unresolved" });
    deps.fetchPinned.mockRejectedValue(new Error("offline"));
    expect(await resolveMarketplaceLink(short, deps)).toEqual({ kind: "error", reason: "network" });
  });
  it("bounds stalled DNS and never fetches after the deadline", async () => {
    vi.useFakeTimers();
    const deps = boundary([]);
    let release = () => {};
    deps.resolvePublicAddresses.mockImplementation(() => new Promise((resolve) => { release = () => resolve(publicAddresses); }));
    const result = resolveMarketplaceLink(short, deps);
    await vi.advanceTimersByTimeAsync(6000);
    expect(await result).toEqual({ kind: "error", reason: "network" });
    release();
    await Promise.resolve();
    expect(deps.fetchPinned).not.toHaveBeenCalled();
  });
  it("never sends Shopee links to the generic LLM fallback", async () => {
    const llm = vi.fn();
    expect(await parseProductText(short, llm)).toBeNull();
    expect(llm).not.toHaveBeenCalled();
  });
});

describe("lazada short-link resolution", () => {
  const lazadaShort = "https://s.lazada.co.th/s.Z9ZEU8";
  const canonical = "https://www.lazada.co.th/products/i16199450766-s127341978928.html";
  const landing = (head: string) => `<!doctype html><html><head>${head}</head><body></body></html>`;
  function lazadaBoundary(responses: Response[]) {
    return {
      resolvePublicAddresses: vi.fn(async () => publicAddresses),
      fetchPinned: vi.fn(async () => responses.shift() ?? new Response(null, { status: 404 })),
    };
  }
  const appMeta = `<meta property="al:ios:url" content="lazada://th/d?itemId=16199450766&amp;skuId=127341978928" />`
    + `<meta property="al:android:url" content="lazada://th/d?itemId=16199450766&skuId=127341978928" />`;

  it("resolves a Lazada short link from app-link meta without further fetch", async () => {
    const deps = lazadaBoundary([new Response(landing(appMeta), { status: 200, headers: { "content-type": "text/html" } })]);
    expect(await resolveMarketplaceLink(lazadaShort, deps)).toEqual({
      kind: "product",
      identity: { platform: "lazada", region: "TH", itemId: "16199450766", skuId: "127341978928", canonicalUrl: canonical },
    });
    expect(deps.fetchPinned).toHaveBeenCalledTimes(1);
  });
  it("falls back to og:url canonical when app-link meta is absent", async () => {
    const html = landing(`<meta property="og:url" content="https://www.lazada.co.th/products/asus-rog-i16199450766-s127341978928.html" />`);
    const deps = lazadaBoundary([new Response(html, { status: 200 })]);
    expect(await resolveMarketplaceLink(lazadaShort, deps)).toMatchObject({
      kind: "product", identity: { platform: "lazada", itemId: "16199450766", skuId: "127341978928" },
    });
  });
  it("returns unresolved when landing HTML carries no identity", async () => {
    const deps = lazadaBoundary([new Response(landing(`<meta property="og:title" content="Nothing here" />`), { status: 200 })]);
    expect(await resolveMarketplaceLink(lazadaShort, deps)).toEqual({ kind: "error", reason: "unresolved" });
  });
  it("validates canonical Lazada URLs inline without fetching", async () => {
    const deps = lazadaBoundary([]);
    expect(await resolveMarketplaceLink(canonical, deps)).toEqual({
      kind: "product",
      identity: { platform: "lazada", region: "TH", itemId: "16199450766", skuId: "127341978928", canonicalUrl: canonical },
    });
    expect(deps.fetchPinned).not.toHaveBeenCalled();
    expect(deps.resolvePublicAddresses).not.toHaveBeenCalled();
  });
  it("blocks wrong-region Lazada URLs without fetching", async () => {
    const deps = lazadaBoundary([]);
    expect(await resolveMarketplaceLink("https://www.lazada.sg/products/a-i16199450766-s127341978928.html", deps))
      .toEqual({ kind: "blocked", reason: "url" });
    expect(deps.fetchPinned).not.toHaveBeenCalled();
  });
  it("maps Lazada network failures to error", async () => {
    const deps = lazadaBoundary([]);
    deps.fetchPinned.mockRejectedValue(new Error("offline"));
    expect(await resolveMarketplaceLink(lazadaShort, deps)).toEqual({ kind: "error", reason: "network" });
  });
  it("still enforces the hop limit on Lazada redirect chains", async () => {
    const deps = boundary(Array.from({ length: 10 }, (_, i) => `https://s.lazada.co.th/s.chain${i}`));
    expect(await resolveMarketplaceLink(lazadaShort, deps)).toEqual({ kind: "blocked", reason: "redirect_limit" });
    expect(deps.fetchPinned).toHaveBeenCalledTimes(MARKETPLACE_REDIRECT_LIMIT);
  });
});

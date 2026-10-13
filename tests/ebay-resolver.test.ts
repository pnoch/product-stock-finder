import { afterEach, describe, expect, it, vi } from "vitest";
import { parseEbayItemFromUrl, resolveMarketplaceLink } from "../server/marketplace-resolver";

const short = "https://ebay.io/m/CV7fAk";
const itemId = "178212205608";
const canonical = `https://www.ebay.com/itm/${itemId}`;
const identity = { platform: "ebay", region: "US", itemId, canonicalUrl: canonical };
const itemHtml = `<html><head><link rel="canonical" href="${canonical}"></head><body>Item</body></html>`;
const publicAddresses = [{ address: "1.1.1.1", family: 4 }];

function ebayDeps() {
  return {
    resolvePublicAddresses: vi.fn(async (): Promise<{ address: string; family: number }[] | null> => null),
    fetchPinned: vi.fn(async () => new Response(null, { status: 404 })),
    renderHtml: vi.fn(async () => ""),
  };
}

afterEach(() => vi.useRealTimers());

describe("ebay short-link resolution", () => {
  it("resolves a short link via rendered HTML to the item identity", async () => {
    const deps = ebayDeps();
    deps.renderHtml.mockResolvedValue(itemHtml);
    expect(await resolveMarketplaceLink(short, deps)).toEqual({ kind: "product", identity });
    expect(deps.renderHtml).toHaveBeenCalledWith(short);
    expect(deps.fetchPinned).not.toHaveBeenCalled();
    expect(deps.resolvePublicAddresses).not.toHaveBeenCalled();
  });

  it("extracts the id from an og:url canonical when rel=canonical is absent", async () => {
    const deps = ebayDeps();
    deps.renderHtml.mockResolvedValue(
      `<html><head><meta property="og:url" content="${canonical}"></head></html>`,
    );
    expect(await resolveMarketplaceLink(short, deps)).toEqual({ kind: "product", identity });
  });

  it("returns unresolved when the render carries no ebay item url", async () => {
    const deps = ebayDeps();
    deps.renderHtml.mockResolvedValue("<html><body>Sign in or register</body></html>");
    expect(await resolveMarketplaceLink(short, deps)).toEqual({ kind: "error", reason: "unresolved" });
  });

  it("rejects a lookalike final host as unresolved", async () => {
    const deps = ebayDeps();
    deps.renderHtml.mockResolvedValue(
      `<html><head><link rel="canonical" href="https://www.ebay.com.evil.example/itm/${itemId}"></head></html>`,
    );
    expect(await resolveMarketplaceLink(short, deps)).toEqual({ kind: "error", reason: "unresolved" });
  });

  it("maps render failures to error instead of throwing", async () => {
    const deps = ebayDeps();
    deps.renderHtml.mockRejectedValue(new Error("browser unavailable"));
    expect(await resolveMarketplaceLink(short, deps)).toEqual({ kind: "error", reason: "network" });
  });

  it("bounds a hung render at 20 seconds", async () => {
    vi.useFakeTimers();
    const deps = ebayDeps();
    deps.renderHtml.mockImplementation(() => new Promise<string>(() => {}));
    const result = resolveMarketplaceLink(short, deps);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await result).toEqual({ kind: "error", reason: "network" });
  });

  it("validates canonical eBay item URLs inline without rendering", async () => {
    const deps = ebayDeps();
    expect(await resolveMarketplaceLink(canonical, deps)).toEqual({ kind: "product", identity });
    expect(deps.renderHtml).not.toHaveBeenCalled();
    expect(deps.fetchPinned).not.toHaveBeenCalled();
    expect(deps.resolvePublicAddresses).not.toHaveBeenCalled();
  });

  it("never routes non-ebay URLs through the ebay render path", async () => {
    const deps = ebayDeps();
    deps.resolvePublicAddresses.mockResolvedValue(publicAddresses);
    deps.fetchPinned.mockImplementation(async () => new Response(null, {
      status: 302,
      headers: { location: "https://shopee.co.th/opaanlp/1950119/28177881956" },
    }));
    const result = await resolveMarketplaceLink("https://s.shopee.co.th/9pf1T7VwV7", deps);
    expect(result).toMatchObject({
      kind: "product",
      identity: { platform: "shopee", shopId: "1950119", itemId: "28177881956" },
    });
    expect(deps.renderHtml).not.toHaveBeenCalled();
    expect(deps.fetchPinned).toHaveBeenCalledTimes(1);
  });

  it("parses item ids only from canonical www.ebay.com item urls", () => {
    expect(parseEbayItemFromUrl(canonical)).toBe(itemId);
    expect(parseEbayItemFromUrl(`${canonical}/`)).toBe(itemId);
    expect(parseEbayItemFromUrl(`https://www.ebay.com/itm/MikroTik-CRS812/${itemId}`)).toBe(itemId);
    expect(parseEbayItemFromUrl(`https://www.ebay.co.uk/itm/${itemId}`)).toBeNull();
    expect(parseEbayItemFromUrl(`http://www.ebay.com/itm/${itemId}`)).toBeNull();
    expect(parseEbayItemFromUrl("not a url")).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { parseFacebookShareRender, resolveMarketplaceLink } from "../server/marketplace-resolver";

const share = "https://www.facebook.com/share/aB9xQz7Km2";
const itemId = "28177881956";
const canonical = `https://www.facebook.com/marketplace/item/${itemId}/`;
const itemHtml = `<html><body><a href="${canonical}">Item</a></body></html>`;
const publicAddresses = [{ address: "1.1.1.1", family: 4 }];

function fbDeps() {
  return {
    resolvePublicAddresses: vi.fn(async (): Promise<{ address: string; family: number }[] | null> => null),
    fetchPinned: vi.fn(async () => new Response(null, { status: 404 })),
    renderHtml: vi.fn(async () => ""),
  };
}

afterEach(() => vi.useRealTimers());

describe("facebook share-link resolution", () => {
  it("resolves a share link via rendered HTML to the item identity", async () => {
    const deps = fbDeps();
    deps.renderHtml.mockResolvedValue(itemHtml);
    expect(await resolveMarketplaceLink(share, deps)).toEqual({
      kind: "product",
      identity: { platform: "facebook", itemId, canonicalUrl: canonical },
    });
    expect(deps.renderHtml).toHaveBeenCalledWith(share);
    expect(deps.fetchPinned).not.toHaveBeenCalled();
    expect(deps.resolvePublicAddresses).not.toHaveBeenCalled();
  });
  it("returns unresolved for a login-walled render without an item id", async () => {
    const deps = fbDeps();
    deps.renderHtml.mockResolvedValue("<html><body>You must log in to continue.</body></html>");
    expect(await resolveMarketplaceLink(share, deps)).toEqual({ kind: "error", reason: "unresolved" });
    expect(deps.renderHtml).toHaveBeenCalledTimes(1);
    expect(deps.fetchPinned).not.toHaveBeenCalled();
  });
  it("maps render failures to error instead of throwing", async () => {
    const deps = fbDeps();
    deps.renderHtml.mockRejectedValue(new Error("browser unavailable"));
    expect(await resolveMarketplaceLink(share, deps)).toEqual({ kind: "error", reason: "network" });
  });
  it("bounds a hung render at 20 seconds", async () => {
    vi.useFakeTimers();
    const deps = fbDeps();
    deps.renderHtml.mockImplementation(() => new Promise<string>(() => {}));
    const result = resolveMarketplaceLink(share, deps);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await result).toEqual({ kind: "error", reason: "network" });
  });
  it("validates canonical Facebook item URLs inline without rendering", async () => {
    const deps = fbDeps();
    expect(await resolveMarketplaceLink(canonical, deps)).toEqual({
      kind: "product",
      identity: { platform: "facebook", itemId, canonicalUrl: canonical },
    });
    expect(deps.renderHtml).not.toHaveBeenCalled();
    expect(deps.fetchPinned).not.toHaveBeenCalled();
    expect(deps.resolvePublicAddresses).not.toHaveBeenCalled();
  });
  it("never routes non-facebook URLs through the render path", async () => {
    const deps = fbDeps();
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
  it("extracts the id from item URLs and item_id JSON", () => {
    expect(parseFacebookShareRender(itemHtml)).toBe(itemId);
    expect(parseFacebookShareRender('{"item_id":321654987}')).toBe("321654987");
    expect(parseFacebookShareRender('{"item_id":"423654987"}')).toBe("423654987");
    expect(parseFacebookShareRender("<html>You must log in</html>")).toBeNull();
    expect(parseFacebookShareRender('{"item_id":"0123"}')).toBeNull();
  });
});
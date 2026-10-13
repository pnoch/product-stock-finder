import { describe, expect, it } from "vitest";
import {
  buildFbSearchUrl,
  classifyFbSearchPage,
  detectEmptyMessage,
  detectLoginWall,
  evaluateProbe,
  extractFbCards,
  extractFbSearchResults,
  facebookListingReader,
  snapshotFromHtml,
} from "../lib/marketplace/fb-search";
import type { MarketplacePageSnapshot } from "../lib/scrapers/webview-host";

const RENDERED = `
<html><body>
<div><a href="/marketplace/item/111111111111111/">Mac Pro 2019 Xeon 24-Core</a>
<span>"listing_price":{"amount":"45,000"},"formatted_price":{"text":"฿45,000"}</span>
<span>Bangkok</span></div>
<div><a href="/marketplace/item/222222222222222/">Ubiquiti UniFi Switch 24</a>
<span>"listing_price":{"amount":"12,500"},"formatted_price":{"text":"฿12,500"}</span>
<span>Nonthaburi</span></div>
<div><a href="/marketplace/item/111111111111111/">Mac Pro 2019 Xeon 24-Core</a>
<span>"listing_price":{"amount":"45,000"},"formatted_price":{"text":"฿45,000"}</span>
<span>Bangkok</span></div>
</body></html>`;

const SEARCH_URL = "https://www.facebook.com/marketplace/search/?query=mac%20pro";

const CARD = {
  itemUrl: "https://www.facebook.com/marketplace/item/111111111111111/",
  title: "Mac Pro",
  priceText: "฿45,000",
  location: "Bangkok",
};

function snap(
  overrides: Partial<MarketplacePageSnapshot> = {},
): MarketplacePageSnapshot {
  return {
    url: SEARCH_URL,
    html: "",
    cards: [],
    scope: { area: null, radiusKm: null },
    emptyMessage: null,
    loginVisible: false,
    ...overrides,
  };
}

describe("buildFbSearchUrl", () => {
  it("builds a search url with query, location, radius", () => {
    expect(buildFbSearchUrl({ query: "mac pro", location: "Bangkok", radiusKm: 30 }))
      .toBe("https://www.facebook.com/marketplace/search/?query=mac%20pro&location=Bangkok&radius=30");
  });

  it("omits empty location", () => {
    expect(buildFbSearchUrl({ query: "laptop", location: "", radiusKm: 64 }))
      .toBe("https://www.facebook.com/marketplace/search/?query=laptop&radius=64");
  });
});

describe("extractFbSearchResults", () => {
  it("extracts listings with title, price, itemId, location", () => {
    const out = extractFbSearchResults(RENDERED);
    expect(out).toHaveLength(2); // deduped by itemId
    expect(out[0]).toMatchObject({
      itemId: "111111111111111",
      title: "Mac Pro 2019 Xeon 24-Core",
      price: 45000,
      currency: "THB",
      location: "Bangkok",
    });
    expect(out[0]!.url).toBe("https://www.facebook.com/marketplace/item/111111111111111/");
  });

  it("caps results at 20", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      `<div><a href="/marketplace/item/${1000000000000000 + i}/">Item ${i}</a><span>฿1,000</span></div>`).join("");
    expect(extractFbSearchResults(`<html><body>${many}</body></html>`)).toHaveLength(20);
  });

  it("does not leak a neighbour's price into a card with no price of its own", () => {
    const html = `<html><body>
      <div class="list">
        <div class="card"><a href="/marketplace/item/111111111111111/">No Price Item</a><span>Bangkok</span></div>
        <div class="card"><a href="/marketplace/item/222222222222222/">Priced Item</a><span>฿2,000</span><span>Phuket</span></div>
      </div></body></html>`;
    const out = extractFbSearchResults(html);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      itemId: "111111111111111",
      price: null,
      currency: null,
      location: "Bangkok",
    });
    expect(out[1]).toMatchObject({
      itemId: "222222222222222",
      price: 2000,
      location: "Phuket",
    });
  });

  it("rejects a container that holds several distinct item ids", () => {
    const html = `<html><body>
      <div class="card">
        <a href="/marketplace/item/333333333333333/">A</a>
        <a href="/marketplace/item/444444444444444/">B</a>
        <span>฿9,999</span>
      </div></body></html>`;
    expect(extractFbCards(html)).toEqual([]);
    expect(extractFbSearchResults(html)).toEqual([]);
  });

  it("keeps price unknown when no THB marker is observed", () => {
    const html = `<html><body>
      <div><a href="/marketplace/item/555555555555555/">USD Item</a><span>$100</span><span>Bangkok</span></div>
      </body></html>`;
    const out = extractFbSearchResults(html);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ itemId: "555555555555555", price: null, currency: null });
  });
});

describe("detectLoginWall / detectEmptyMessage", () => {
  it("detects a login form but not a bare header Login link", () => {
    expect(
      detectLoginWall(
        `<html><body><form><input type="password"><div>Log in</div></form></body></html>`,
      ),
    ).toBe(true);
    expect(
      detectLoginWall(
        `<html><body><header><a href="/login">Log in</a></header><div>Marketplace</div></body></html>`,
      ),
    ).toBe(false);
  });

  it("only reports an empty result on a recognized search page", () => {
    const html = `<html><body><div>No listings found</div></body></html>`;
    expect(detectEmptyMessage(html, SEARCH_URL)).toMatch(/no listings found/i);
    expect(
      detectEmptyMessage(html, "https://www.facebook.com/marketplace/"),
    ).toBeNull();
  });
});

describe("classifyFbSearchPage", () => {
  it("classifies a login dialog as login_required", () => {
    const page = snapshotFromHtml(
      `<html><body><div role="dialog"><input type="password"><div>Log in</div><div>Forgotten password?</div></div></body></html>`,
      SEARCH_URL,
    );
    expect(classifyFbSearchPage(page)).toEqual({ kind: "login_required" });
  });

  it("does not treat a header Login link alone as a wall", () => {
    const page = snapshotFromHtml(
      `<html><body><header><a href="/login">Log in</a></header><div>Marketplace</div></body></html>`,
      SEARCH_URL,
    );
    expect(classifyFbSearchPage(page)).toEqual({ kind: "unverified", reason: "unreadable" });
  });

  it("classifies a genuine empty search page as empty", () => {
    const page = snapshotFromHtml(
      `<html><body><div>No listings found</div><div>Try a different search</div></body></html>`,
      SEARCH_URL,
    );
    expect(classifyFbSearchPage(page)).toEqual({ kind: "empty" });
  });

  it("classifies an unrecognized zero-card page as unverified", () => {
    const page = snapshotFromHtml(
      `<html><body><div>Something went wrong</div></body></html>`,
      SEARCH_URL,
    );
    expect(classifyFbSearchPage(page)).toEqual({ kind: "unverified", reason: "unreadable" });
  });

  it("rejects a snapshot whose final host is not Facebook", () => {
    const page = snap({
      url: "https://evil.example.com/marketplace/search/?query=x",
      cards: [CARD],
    });
    expect(classifyFbSearchPage(page)).toEqual({ kind: "unverified", reason: "final-host" });
  });

  it("reports observed scope and never infers it from the request", () => {
    const observed = classifyFbSearchPage(
      snap({ cards: [CARD], scope: { area: "San Francisco", radiusKm: 40 } }),
    );
    expect(observed).toEqual({
      kind: "listings",
      listings: expect.any(Array),
      observedScope: { area: "San Francisco", radiusKm: 40 },
    });

    const unknown = classifyFbSearchPage(snap({ cards: [CARD] }));
    expect(unknown).toMatchObject({ observedScope: { area: null, radiusKm: null } });
    // The requested URL still says Bangkok/64; observed scope is not derived from it.
    expect(buildFbSearchUrl({ query: "mac pro", location: "Bangkok", radiusKm: 64 })).toContain("Bangkok");
  });
});

describe("evaluateProbe", () => {
  const now = "2026-10-13T00:00:00.000Z";

  it("never marks a navigation-only probe ready", () => {
    expect(
      evaluateProbe({
        capability: { kind: "navigation" },
        snapshot: snap({ cards: [CARD] }),
        now,
      }),
    ).toEqual({ kind: "unverified", checkedAt: now, reason: "navigation-only" });
  });

  it("marks a search probe ready only with recognized cards or a verified empty page", () => {
    expect(
      evaluateProbe({
        capability: { kind: "search", query: "mac pro" },
        snapshot: snap({ cards: [CARD] }),
        now,
      }),
    ).toEqual({
      kind: "ready",
      checkedAt: now,
      capability: { kind: "search", query: "mac pro" },
    });
    expect(
      evaluateProbe({
        capability: { kind: "search", query: "mac pro" },
        snapshot: snap({ emptyMessage: "No listings found" }),
        now,
      }),
    ).toMatchObject({ kind: "ready" });
    expect(
      evaluateProbe({
        capability: { kind: "search", query: "mac pro" },
        snapshot: snap(),
        now,
      }),
    ).toEqual({ kind: "unverified", checkedAt: now, reason: "no-recognized-results" });
  });

  it("requires matching identity and a readable price for a listing probe", () => {
    const capability = { kind: "listing" as const, productId: "111111111111111" };
    expect(
      evaluateProbe({
        capability,
        snapshot: snap({ cards: [CARD] }),
        readListing: facebookListingReader("111111111111111"),
        now,
      }),
    ).toMatchObject({ kind: "ready", capability });

    expect(
      evaluateProbe({
        capability,
        snapshot: snap({ cards: [CARD] }),
        readListing: facebookListingReader("999999999999999"),
        now,
      }),
    ).toEqual({ kind: "unverified", checkedAt: now, reason: "listing-unconfirmed" });
  });

  it("cannot verify a listing probe without a reader", () => {
    expect(
      evaluateProbe({
        capability: { kind: "listing", productId: "111111111111111" },
        snapshot: snap({ cards: [CARD] }),
        now,
      }),
    ).toEqual({ kind: "unverified", checkedAt: now, reason: "no-listing-reader" });
  });
});

import { describe, expect, it } from "vitest";
import { extractFbSearchResults, buildFbSearchUrl } from "../lib/marketplace/fb-search";

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

  it("returns empty for a login wall (distinct from no results)", () => {
    // Login pages contain the form but no item links.
    const wall = `<html><body><div>Log in</div><div>Email address or phone number</div><div>Forgotten password?</div></body></html>`;
    expect(extractFbSearchResults(wall)).toEqual([]);
  });

  it("returns empty when nothing matches", () => {
    expect(extractFbSearchResults("<html><body><div>No listings found</div></body></html>")).toEqual([]);
  });

  it("caps results at 20", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      `<a href="/marketplace/item/${1000000000000000 + i}/">Item ${i}</a><span>"listing_price":{"amount":"1,000"},"formatted_price":{"text":"฿1,000"}</span>`).join("");
    expect(extractFbSearchResults(`<html><body>${many}</body></html>`)).toHaveLength(20);
  });
});

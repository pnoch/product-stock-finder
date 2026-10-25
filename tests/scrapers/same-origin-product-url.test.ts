import { describe, expect, it } from "vitest";
import { sameOriginProductUrl } from "@/lib/scrapers/resilient";

const SEARCH = "https://www.mikrotik-store.eu/en/search?query=CRS804";

describe("sameOriginProductUrl", () => {
  it("resolves relative product links against the search URL", () => {
    expect(sameOriginProductUrl("/en/mikrotik-crs804", SEARCH)).toBe(
      "https://www.mikrotik-store.eu/en/mikrotik-crs804",
    );
  });

  it("keeps absolute same-origin links", () => {
    expect(
      sameOriginProductUrl(
        "https://www.mikrotik-store.eu/en/mikrotik-crs804",
        SEARCH,
      ),
    ).toBe("https://www.mikrotik-store.eu/en/mikrotik-crs804");
  });

  it("rejects cross-origin hops from scraped HTML", () => {
    expect(sameOriginProductUrl("https://evil.example/steal", SEARCH)).toBeNull();
    expect(sameOriginProductUrl("//evil.example/steal", SEARCH)).toBeNull();
  });

  it("rejects non-http schemes and unparsable input", () => {
    expect(sameOriginProductUrl("javascript:alert(1)", SEARCH)).toBeNull();
    expect(sameOriginProductUrl("data:text/html,x", SEARCH)).toBeNull();
    expect(sameOriginProductUrl("/en/x", "not a url")).toBeNull();
    expect(sameOriginProductUrl(null, SEARCH)).toBeNull();
  });
});

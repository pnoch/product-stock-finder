import { afterEach, describe, expect, it, vi } from "vitest";
import * as cheerio from "cheerio";
import {
  fetchWithParser,
  fetchWithRateLimit,
  findPriceElement,
  matchesModel,
  parsePriceFromText,
  productRowContext,
  modelMismatch,
} from "../../lib/scrapers/utils";
import type { DistributorParser } from "../../lib/scrapers/types";

const bg = vi.hoisted(() => ({ state: "active" as string }));
vi.mock("../../lib/background-safe-timers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../lib/background-safe-timers")>();
  return { ...actual, getBackgroundAppState: () => bg.state };
});

const browserMock = vi.hoisted(() => ({ fetchWithBrowser: vi.fn() }));
vi.mock("../../lib/scrapers/browser", () => ({
  fetchWithBrowser: (...a: unknown[]) =>
    browserMock.fetchWithBrowser(...(a as [string, unknown])),
}));

function stubParser(overrides: Partial<DistributorParser> = {}): DistributorParser {
  return {
    id: "d1",
    baseUrl: "https://example.com",
    buildSearchUrl: (model) => `https://example.com/search?q=${model}`,
    parsePrice: () => null,
    rateLimitMs: 0,
    ...overrides,
  };
}

afterEach(() => {
  bg.state = "active";
  vi.unstubAllGlobals();
  browserMock.fetchWithBrowser.mockReset();
});

describe("matchesModel", () => {
  it("matches the spec-table positives", () => {
    expect(
      matchesModel("MikroTik CRS804-4DDQ-hRM RouterOS7", "CRS804-4DDQ-hRM"),
    ).toBe(true);
    expect(matchesModel("hEX-S (RouterOS L4)", "hEX S")).toBe(true);
    expect(matchesModel("crs326 24g 2s+ rack switch", "CRS326-24G-2S+")).toBe(
      true,
    );
  });

  it("rejects prefix/suffix SKU extensions", () => {
    expect(matchesModel("RB5009UG+S+IN", "RB5009")).toBe(false);
    expect(matchesModel("hEX", "hEX S")).toBe(false);
  });

  it("rejects embedded occurrences", () => {
    expect(matchesModel("xRB5009y", "RB5009")).toBe(false);
    expect(matchesModel("4032CRS804 kit", "CRS804")).toBe(false);
    // A digit prefix means a different model number.
    expect(matchesModel("CRS3260-24G", "CRS326")).toBe(false);
  });

  it("matches whitespace-less card text (brand concatenated to the model)", () => {
    // Aerial renders "MikroTik" immediately before the model with no separator.
    expect(matchesModel("MikroTikCRS326-24G-2S+IN", "CRS326-24G-2S+")).toBe(true);
    expect(matchesModel("MikroTikCRS326-24S+2Q+RM", "CRS326-24S+2Q+RM")).toBe(true);
  });

  it("is case-insensitive and separator-flexible", () => {
    expect(
      matchesModel("MIKROTIK CRS804-4DDQ-HRM", "CrS804-4DdQ-hRm"),
    ).toBe(true);
    expect(matchesModel("RB5009UG+S+IN", "rb5009ug s in")).toBe(true);
  });

  it("accepts when only a later candidate sits on boundaries", () => {
    expect(matchesModel("xRB5009 y RB5009 z", "RB5009")).toBe(true);
  });

  it("accepts known commerce suffixes after a separator", () => {
    expect(
      matchesModel("MikroTik CRS326-24G-2S+RM switch", "CRS326-24G-2S+"),
    ).toBe(true);
    expect(matchesModel("CRS326-24G-2S+IN", "CRS326-24G-2S+")).toBe(true);
  });

  it("still rejects unknown extensions and mid-token runs", () => {
    expect(matchesModel("CRS326-24G-2S+XTX", "CRS326-24G-2S+")).toBe(false);
    expect(matchesModel("RB5009UG+S+IN", "RB5009")).toBe(false);
  });

  it("returns false for empty or unusable inputs", () => {
    expect(matchesModel("", "RB5009")).toBe(false);
    expect(matchesModel("some text", "")).toBe(false);
    expect(matchesModel("some text", "   ")).toBe(false);
  });
});

describe("productRowContext", () => {
  const ROW_HTML = `<html><body><table>
    <tr class="product">
      <td><a href="/p/crs804">MikroTik CRS804</a></td>
      <td><span class="price">$480.00</span></td>
    </tr>
  </table></body></html>`;

  it("climbs to the row container and extracts text + href", () => {
    const $ = cheerio.load(ROW_HTML);
    const ctx = productRowContext($(".price").first());
    expect(ctx.text).toContain("MikroTik CRS804");
    expect(ctx.href).toBe("/p/crs804");
  });

  it("falls back to the element itself when no container matches", () => {
    const $ = cheerio.load(`<div><span class="price">$5.00</span></div>`);
    const ctx = productRowContext($(".price").first());
    expect(ctx.text).toContain("$5.00");
    expect(ctx.href).toBe("");
  });
});

describe("modelMismatch", () => {
  const ROW_HTML = `<html><body><table>
    <tr class="product">
      <td><a href="/p/crs804">MikroTik CRS804</a></td>
      <td><span class="price">$480.00</span></td>
    </tr>
  </table></body></html>`;
  const $ = cheerio.load(ROW_HTML);

  it("is false when no model is provided", () => {
    expect(modelMismatch($(".price").first(), undefined)).toBe(false);
  });

  it("is true when the row names a different product", () => {
    expect(modelMismatch($(".price").first(), "CRS326-24G-2S+")).toBe(true);
  });

  it("matches the model in the product link href", () => {
    // Cards frequently name the model only in the product URL.
    const html = `<div class="product-item">
      <a href="/p/crs804-4ddq-hrm">MikroTik Switch</a>
      <span class="price">$480.00</span></div>`;
    const $$ = cheerio.load(html);
    expect(modelMismatch($$(".price").first(), "CRS804-4DDQ-hRM")).toBe(false);
    expect(modelMismatch($$(".price").first(), "CRS326-24G-2S+")).toBe(true);
  });

  it("is false when the row names the requested product", () => {
    expect(modelMismatch($(".price").first(), "CRS804")).toBe(false);
  });

  it("accepts (false) when the context is empty", () => {
    const bare = cheerio.load(`<span>   </span>`);
    expect(modelMismatch(bare("span").first(), "CRS804")).toBe(false);
  });

  it("finds the model one ancestor above the priced element", () => {
    const $ = cheerio.load(`<div class="productitem">
      <div class="info"><a href="/p/crs326">MikroTik CRS326-24G-2S+RM</a>
        <div class="price">$199.00</div></div></div>`);
    expect(modelMismatch($(".price").first(), "CRS326-24G-2S+")).toBe(false);
  });

  it("does not reach page-level headers five levels up", () => {
    const $ = cheerio.load(`<body><header>Search results for CRS326-24G-2S+</header>
      <div><div><div><div><span class="price">$5.00</span></div></div></div></div></body>`);
    expect(modelMismatch($("span.price").first(), "CRS326-24G-2S+")).toBe(true);
  });

  it("does not treat a generic .item list wrapper as the product card", () => {
    // A results grid whose wrapper is <ul class="item"> with bare <li> cards:
    // the wrapper's text names every product, so using it as the boundary would
    // validate the decoy's price for the requested model.
    const $ = cheerio.load(`<ul class="item">
      <li><h3>MikroTik CRS326-24G-2S+</h3><span class="price">$199.00</span></li>
      <li><h3>MikroTik CRS804-4DDQ-hRM</h3><span class="price">$480.00</span></li>
    </ul>`);
    const prices = $(".price");
    expect(modelMismatch(prices.eq(0), "CRS804-4DDQ-hRM")).toBe(true);
    expect(modelMismatch(prices.eq(1), "CRS804-4DDQ-hRM")).toBe(false);
  });

  it("accepts a Magento product-item-details row via closest()", () => {
    const $ = cheerio.load(`<li class="product-item">
      <div class="product details product-item-details">
        RTB-CRS326-24G-2S+IN Mikrotik CRS326-24G-2S+IN
        <span class="price">€162.11</span> Add to Cart
      </div></li>`);
    expect(modelMismatch($("span.price").first(), "CRS326-24G-2S+")).toBe(
      false,
    );
  });

  it("rejects a decoy price when only <body> names the model", () => {
    // A search-results page whose <h1> names the model must not validate a
    // price that has no product card of its own.
    const $ = cheerio.load(`<html><body>
      <h1>Search results for CRS804-4DDQ-hRM</h1>
      <div><span class="price">$1.00</span></div>
    </body></html>`);
    expect(modelMismatch($("span.price").first(), "CRS804-4DDQ-hRM")).toBe(
      true,
    );
  });

  it("still accepts a product container heading above the price", () => {
    const $ = cheerio.load(`<html><body><div class="product-detail">
      <h1>MikroTik CRS804-4DDQ-hRM</h1>
      <span class="price-tag">1.181,67 EUR</span>
    </div></body></html>`);
    expect(modelMismatch($("span.price-tag").first(), "CRS804-4DDQ-hRM")).toBe(
      false,
    );
  });
});

describe("findPriceElement", () => {
  const TWO_PRODUCT_HTML = `<div class="search-results">
    <div class="product-card">
      <h2><a href="/p/OTHER-MODEL-X1">OTHER-MODEL-X1 Router</a></h2>
      <span class="price">$999.00</span>
    </div>
    <div class="product-card">
      <h2><a href="/p/TARGET-MODEL-9Z">TARGET-MODEL-9Z Switch</a></h2>
      <span class="price">$1.00</span>
    </div>
  </div>`;

  it("prefers the price whose card matches the model over document order", async () => {
    const { findPriceElement } = await import("../../lib/scrapers/utils");
    const $ = cheerio.load(TWO_PRODUCT_HTML);
    const $price = findPriceElement($, ".price", "TARGET-MODEL-9Z");
    expect($price).not.toBeNull();
    expect($price!.text()).toContain("1.00");
  });

  it("returns null when no price context matches the model", async () => {
    const { findPriceElement } = await import("../../lib/scrapers/utils");
    const $ = cheerio.load(TWO_PRODUCT_HTML);
    expect(findPriceElement($, ".price", "NOPE-NOT-HERE-0Z")).toBeNull();
  });

  it("falls back to document order when no model is given", async () => {
    const { findPriceElement } = await import("../../lib/scrapers/utils");
    const $ = cheerio.load(TWO_PRODUCT_HTML);
    const $price = findPriceElement($, ".price");
    expect($price).not.toBeNull();
    expect($price!.text()).toContain("999.00");
  });

  it("returns null when the selector matches nothing", async () => {
    const { findPriceElement } = await import("../../lib/scrapers/utils");
    const $ = cheerio.load(TWO_PRODUCT_HTML);
    expect(findPriceElement($, ".nope", "TARGET-MODEL-9Z")).toBeNull();
  });
});

describe("findPriceElement model-digit guard", () => {
  it("prefers a candidate whose first digits are not the model's", () => {
    const $ = cheerio.load(`<table><tr class="product">
      <td><span class="sku">CRS804</span> <span class="price">$480.00</span></td>
      <td><span class="price">$480.00</span></td>
    </tr></table>`);
    const el = findPriceElement(
      $ as unknown as Parameters<typeof findPriceElement>[0],
      'td:contains("$")',
      "CRS804",
    );
    // Without the guard the first cell wins and its text parses as 804.
    expect(el?.text()).toBe("$480.00");
    expect(parsePriceFromText(el!.text())).toBe(480);
  });

  it("still falls back to a model-bearing candidate when it is the only one", () => {
    const $ = cheerio.load(`<table><tr class="product">
      <td>CRS804 <span class="price">$480.00</span></td>
    </tr></table>`);
    const el = findPriceElement(
      $ as unknown as Parameters<typeof findPriceElement>[0],
      'td:contains("$")',
      "CRS804",
    );
    expect(el).not.toBeNull();
  });
});

describe("fetchWithRateLimit", () => {
  it("returns the body on a foreground 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>ok</html>", { status: 200 })),
    );
    expect(await fetchWithRateLimit("https://x/", 0)).toBe("<html>ok</html>");
  });

  it("throws with the status on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("no", {
            status: 503,
            statusText: "Service Unavailable",
          }),
      ),
    );
    await expect(fetchWithRateLimit("https://x/", 0)).rejects.toThrow(
      "HTTP 503",
    );
  });

  it("skips the politeness delay and fetches directly when backgrounded", async () => {
    bg.state = "background";
    const fetchMock = vi.fn(async () => new Response("bg", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchWithRateLimit("https://x/", 5000)).toBe("bg");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("fetchWithParser", () => {
  it("uses the plain rate-limited fetch when no browser is configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("plain", { status: 200 })),
    );
    expect(await fetchWithParser(stubParser(), "https://x/")).toBe("plain");
  });

  it("uses the browser when the parser opts in", async () => {
    browserMock.fetchWithBrowser.mockResolvedValue("<html>b</html>");
    expect(
      await fetchWithParser(stubParser({ useBrowser: true }), "https://x/"),
    ).toBe("<html>b</html>");
    expect(browserMock.fetchWithBrowser).toHaveBeenCalledWith(
      "https://x/",
      undefined,
    );
  });

  it("falls back to plain HTTP when the browser module is unavailable", async () => {
    browserMock.fetchWithBrowser.mockRejectedValue(new Error("no playwright"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("fallback", { status: 200 })),
    );
    expect(
      await fetchWithParser(stubParser({ useBrowser: true }), "https://x/"),
    ).toBe("fallback");
  });
});

describe("fetchWithRateLimit background failure", () => {
  it("throws with the status when backgrounded and not ok", async () => {
    bg.state = "background";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("no", { status: 502, statusText: "Bad Gateway" }),
      ),
    );
    await expect(fetchWithRateLimit("https://x/", 5000)).rejects.toThrow(
      "HTTP 502",
    );
  });
});

describe("parsePriceFromText separator styles", () => {
  it("reads a comma-decimal with dot thousands grouping", () => {
    expect(parsePriceFromText("€ 1.234,56")).toBe(1234.56);
    expect(parsePriceFromText("12,5")).toBe(12.5);
  });

  it("reads dot-only groups of three as thousands separators", () => {
    expect(parsePriceFromText("1.299")).toBe(1299);
    expect(parsePriceFromText("R 12 345.67")).toBe(12345.67);
  });
});

describe("parsePriceFromText currency anchoring", () => {
  it("ignores model digits that precede a currency-anchored price", () => {
    expect(parsePriceFromText("CRS804-4DDQ+RM $480.00")).toBe(480);
    expect(parsePriceFromText("MikroTik CRS326-24G $1,299.00")).toBe(1299);
    expect(parsePriceFromText("RB4011 $ 219.99")).toBe(219.99);
    expect(parsePriceFromText("CRS804 USD 480.00")).toBe(480);
    expect(parsePriceFromText("480.00 EUR")).toBe(480);
  });

  it("keeps the first run when no currency marker is adjacent", () => {
    expect(parsePriceFromText("804")).toBe(804);
    expect(parsePriceFromText("1 234,56 Kč")).toBe(1234.56);
    expect(parsePriceFromText("12,345")).toBe(12345);
  });
});

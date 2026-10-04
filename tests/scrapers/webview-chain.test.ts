// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

// Force resilient's dynamic `import("./browser")` to resolve to the native
// adapter (as the Metro resolver does on Android), so this exercises the real
// chain: fetchAndParse -> browser-native -> webview host -> rendered HTML ->
// parser.parsePrice.
vi.mock("@/lib/scrapers/browser", () => import("@/lib/scrapers/browser-native"));

import { pbtechParser } from "@/lib/scrapers/pbtech";
import { setWebViewHost } from "@/lib/scrapers/webview-host";
import { fetchAndParse, createMemoryBreakerStore } from "@/lib/scrapers/resilient";

// Rendered search-results page for the requested model (mirrors the pbtech
// fixture): a product row naming CRS804-4DDQ-hRM at NZ$480, in stock.
const RENDERED_HTML = `<html><body><table><tr class="product">
  <td><span class="price nobr product-price" data-product-price data-price-container>$480.00</span>
  <a class="product-link" href="/p/crs804-4ddq-hrm">MikroTik CRS804-4DDQ-hRM</a></td>
  <td><span class="stock-status availability stock">In Stock</span></td>
</tr></table></body></html>`;

const MODEL = "CRS804-4DDQ-hRM";
const SEARCH_URL = "https://www.pbtech.co.nz/search?sf=CRS804-4DDQ-hRM";

describe("native webview chain", () => {
  afterEach(() => {
    setWebViewHost(null);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("renders through the host and parses the price (browser-first parser)", async () => {
    const load = vi.fn(async () => RENDERED_HTML);
    setWebViewHost({ load });

    const { result } = await fetchAndParse(
      pbtechParser,
      MODEL,
      createMemoryBreakerStore(),
    );

    expect(result).not.toBeNull();
    expect(result!.price).toBe(480);
    expect(result!.currency).toBe("NZD");
    expect(result!.stockStatus).toBe("in_stock");
    // The renderer was asked for the parser's search URL (not the raw model).
    expect(load).toHaveBeenCalledWith(SEARCH_URL, expect.anything());
  });

  it("falls back to plain HTTP when no host is mounted", async () => {
    vi.useFakeTimers();
    // No setWebViewHost -> browser-native throws BrowserUnavailableError and
    // resilient falls through to the plain fetch.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(RENDERED_HTML, { status: 200 })),
    );

    const pending = fetchAndParse(pbtechParser, MODEL, createMemoryBreakerStore());
    await vi.advanceTimersByTimeAsync(30_000);
    const { result } = await pending;
    expect(result?.price).toBe(480);
  });

  it("classifies a rendered challenge page as blocked (no price)", async () => {
    vi.useFakeTimers();
    setWebViewHost({
      load: vi.fn(
        async () => "<html><title>Just a moment...</title><body>Checking your browser</body></html>",
      ),
    });
    // The plain fallback is offline too, so the outcome is a miss not a price.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    const pending = fetchAndParse(pbtechParser, MODEL, createMemoryBreakerStore());
    await vi.advanceTimersByTimeAsync(30_000);
    const { result, outcome } = await pending;
    expect(result).toBeNull();
    expect(outcome.status).toBe("blocked");
  });
});

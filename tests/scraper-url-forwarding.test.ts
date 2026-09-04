import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { server2uParser } from "../lib/scrapers/server2u";
import { balticnetworksParser } from "../lib/scrapers/balticnetworks";

const SCRAPERS_DIR = path.join(__dirname, "../lib/scrapers");

describe("parser URL forwarding", () => {
  it("no parser hardcodes an origin URL in its parsePrice arrow", () => {
    const offenders: string[] = [];
    for (const file of readdirSync(SCRAPERS_DIR)) {
      if (!file.endsWith(".ts") || file === "browser.web.ts" || file === "types.ts" || file === "utils.ts" || file === "registry.ts" || file === "resilient.ts" || file === "health.ts" || file === "browser.ts") continue;
      const text = readFileSync(path.join(SCRAPERS_DIR, file), "utf8");
      if (!text.includes("parsePrice:")) continue;
      // The parsePrice arrow must accept the url param and forward it
      // (falling back to the origin only when absent).
      const arrow = text.match(/parsePrice:\s*\(html,\s*model(?:,\s*url)?\)\s*=>/);
      if (!arrow || !arrow[0].includes("url")) {
        offenders.push(`${file} (missing url param)`);
        continue;
      }
      const call = text.match(/parse(?:Html|ProductPage)\(\s*html,\s*([^,]+),/);
      if (!call || /^"https?:/.test(call[1]!.trim())) {
        offenders.push(`${file} (hardcoded origin)`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("server2u returns the passed URL, not the homepage", () => {
    const html = `<div><span class="product-price">$1,299.00</span><span class="stock-status">In Stock</span></div>`;
    const result = server2uParser.parsePrice(
      html,
      undefined,
      "https://server2u.com/shop/crs804-test",
    );
    expect(result).not.toBeNull();
    expect(result!.url).toBe("https://server2u.com/shop/crs804-test");
  });

  it("balticnetworks returns the passed URL, not the homepage", () => {
    const html = `<div><span class="price__current">$209.00</span><span class="productitem__stock">In Stock</span></div>`;
    const result = balticnetworksParser.parsePrice(
      html,
      undefined,
      "https://balticnetworks.com/crs804-test",
    );
    expect(result).not.toBeNull();
    expect(result!.url).toBe("https://balticnetworks.com/crs804-test");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isPlausiblePrice, MAX_PLAUSIBLE_PRICE } from "@shared/const";

// Shared by the server price cache and the client device-scrape paths, so the
// exact boundary matters: a price just over the cap must be rejected, and the
// cap itself accepted.
describe("isPlausiblePrice", () => {
  it("accepts finite positive prices up to the cap", () => {
    expect(isPlausiblePrice(0.01)).toBe(true);
    expect(isPlausiblePrice(100)).toBe(true);
    expect(isPlausiblePrice(MAX_PLAUSIBLE_PRICE)).toBe(true);
  });

  it("rejects zero, negatives, non-finite, and over-cap prices", () => {
    expect(isPlausiblePrice(0)).toBe(false);
    expect(isPlausiblePrice(-1)).toBe(false);
    expect(isPlausiblePrice(NaN)).toBe(false);
    expect(isPlausiblePrice(Infinity)).toBe(false);
    expect(isPlausiblePrice(MAX_PLAUSIBLE_PRICE + 1)).toBe(false);
  });

  it("the desktop Rust parser enforces the same bound", () => {
    // The desktop scrape path must reject an implausible price too, or a
    // misparsed SKU is stored on desktop but rejected on mobile/server.
    const rust = readFileSync(
      join(__dirname, "..", "desktop", "src-tauri", "src", "scrapers", "mod.rs"),
      "utf8",
    );
    expect(rust).toContain("pub const MAX_PLAUSIBLE_PRICE: f64 = 1e7");
    expect(rust).toContain("pub fn is_plausible_price");
    // parse_price_page must call the guard before returning a price.
    expect(rust).toMatch(/is_plausible_price\(price\)/);
  });
});

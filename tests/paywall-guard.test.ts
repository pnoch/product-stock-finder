import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("paywall", () => {
  it("is honest without a purchase provider", () => {
    const src = read("components/paywall/paywall-screen.tsx");
    // The CTA must be disabled when there is no provider.purchase.
    expect(src).toContain("coming soon");
    expect(src).toContain("getEntitlementProvider");
  });

  it("lists the Pro benefits", () => {
    const src = read("components/paywall/paywall-screen.tsx");
    expect(src).toContain("Unlimited watchlist");
    expect(src).toContain("Background monitoring");
    expect(src).toContain("Bulk import");
  });
});

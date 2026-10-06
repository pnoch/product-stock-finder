import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("paywall", () => {
  it("disables the CTA without a purchase provider", () => {
    const src = read("components/paywall/paywall-screen.tsx");
    // The CTA must be gated on the provider's purchase method and disabled.
    expect(src).toContain("getEntitlementProvider");
    expect(src).toMatch(/purchasable/);
    expect(src).toMatch(/disabled=\{!purchasable/);
    expect(src).toContain("Pro is coming soon");
    // No purchase call without a provider: the handler must early-return.
    expect(src).toMatch(/if\s*\(!purchasable\)\s*return/);
  });

  it("lists the Pro benefits", () => {
    const src = read("components/paywall/paywall-screen.tsx");
    expect(src).toContain("Unlimited watchlist");
    expect(src).toContain("Background monitoring");
    expect(src).toContain("Bulk import");
  });
});

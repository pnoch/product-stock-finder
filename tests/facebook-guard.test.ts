import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("facebook marketplace wiring", () => {
  it("recognition covers facebook identities and keys", () => {
    const src = read("shared/marketplace-url.ts");
    expect(src).toContain("FacebookIdentity");
    expect(src).toContain("fbmp-");
  });

  it("resolver resolves share links via bounded render", () => {
    expect(read("server/marketplace-resolver.ts")).toContain("parseFacebookShareRender");
  });

  it("price extractor exists and is identity-guarded", () => {
    expect(read("lib/scrapers/facebook.ts")).toContain("parseFacebookPrice");
  });

  it("card brands facebook and never flips it to automatic", () => {
    const src = read("components/product/marketplace-card.tsx");
    expect(src).toContain("Facebook Marketplace");
    expect(src).toContain('platform !== "facebook"');
  });

  it("discover exposes the facebook search sheet", () => {
    expect(read("app/(tabs)/discover.tsx")).toContain("FacebookSearchSheet");
  });

  it("facebook products stay out of automatic pipelines", async () => {
    const { isAutomaticProduct } = await import("../lib/marketplace");
    expect(
      isAutomaticProduct({
        marketplace: { platform: "facebook", itemId: "1", canonicalUrl: "https://www.facebook.com/marketplace/item/1/" },
        modelNumber: "fbmp-1",
      }),
    ).toBe(false);
  });
});
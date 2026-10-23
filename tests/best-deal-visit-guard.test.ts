import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("best-deal visit CTA", () => {
  it("the best-deal card offers a Visit action that opens the listing url", () => {
    const src = readFileSync(
      join(__dirname, "..", "components/product/best-deal-estimate-card.tsx"),
      "utf8",
    );
    expect(src).toContain("openListingUrl");
    expect(src).toMatch(/Visit store/);
  });
});

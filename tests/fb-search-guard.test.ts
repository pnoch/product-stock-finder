import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");

describe("fb search relay wiring", () => {
  it("search module exists with state machine", () => {
    const src = read("lib/marketplace/fb-search.ts");
    expect(src).toContain("searchFbMarketplace");
    expect(src).toContain("login_required");
  });

  it("search screen renders the facebook section", () => {
    expect(read("app/search.tsx")).toContain("FacebookResultsSection");
  });

  it("section never claims full coverage", () => {
    const src = read("components/search/facebook-results-section.tsx");
    expect(src).not.toMatch(/all (listings|results)/i);
  });
});

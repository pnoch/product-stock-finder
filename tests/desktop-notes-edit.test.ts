import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("desktop notes and edit", () => {
  it("has a product notes card", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("getProductNote");
    expect(text).toContain("My Note");
  });

  it("edits product details in place", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("updateProductDetails");
    expect(text).toContain("Edit product");
  });
});

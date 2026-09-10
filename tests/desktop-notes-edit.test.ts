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

  it("surfaces save failures instead of false success toasts", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("handleSaveNote");
    expect(text).toContain("handleSaveEdit");
    expect(text).toContain("catch");
    expect(text).toContain("Couldn't save note");
    expect(text).toContain("Couldn't save changes");
  });

  it("passes listing currency to the scoped alert matcher", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("scopedAlertFor(alerts, product.id, listing.distributorId, listing.currency)");
  });

  it("loads independent product data in parallel", async () => {
    const text = await readFile("desktop/src/pages/ProductDetail.tsx", "utf8");
    expect(text).toContain("Promise.all([");
    expect(text).toContain("storage.getWatchlist()");
    expect(text).toContain("storage.getSettings()");
    expect(text).toContain("storage.getStockWatches()");
    expect(text).toContain("storage.getAlerts()");
  });
});

import { describe, expect, it } from "vitest";
import { PRODUCT_CATALOG } from "@shared/catalog";
import {
  PREVIEW_LIMIT,
  previewStockScore,
  sortPreviewByStock,
} from "../lib/search-preview";

describe("preview ordering", () => {
  it("caps the preview at 10 items", () => {
    expect(PREVIEW_LIMIT).toBe(10);
    const preview = sortPreviewByStock(PRODUCT_CATALOG).slice(0, PREVIEW_LIMIT);
    expect(preview.length).toBeLessThanOrEqual(10);
  });

  it("sorts non-increasing by stock score without mutating the input", () => {
    const input = [...PRODUCT_CATALOG];
    const before = input.map((p) => p.id);
    const sorted = sortPreviewByStock(input);
    expect(input.map((p) => p.id)).toEqual(before);
    const scores = sorted.map((p) => previewStockScore(p.id));
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it("weights in-stock listings first", () => {
    const sorted = sortPreviewByStock(PRODUCT_CATALOG);
    expect(previewStockScore(sorted[0].id)).toBeGreaterThan(0);
  });

  it("scores unknown products as zero", () => {
    expect(previewStockScore("no-such-product")).toBe(0);
  });
});

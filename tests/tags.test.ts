import { describe, expect, it } from "vitest";
import {
  TAG_PALETTE,
  generateTagId,
  getTagById,
  matchesTagFilter,
  nextTagColor,
  tagColor,
} from "../lib/tags";
import { Product, TagDefinition } from "../lib/types";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    name: "Test Product",
    modelNumber: "TP-1",
    brand: "Test",
    category: "Switch",
    description: "",
    addedAt: "2026-01-01T00:00:00.000Z",
    isWatched: true,
    listings: [],
    ...overrides,
  };
}

function makeDefs(...tags: TagDefinition[]): Record<string, TagDefinition> {
  return Object.fromEntries(tags.map((t) => [t.id, t]));
}

describe("nextTagColor", () => {
  it("returns the first unused palette color", () => {
    const d = makeDefs({ id: "a", name: "A", color: TAG_PALETTE[0] });
    expect(nextTagColor(d)).toBe(TAG_PALETTE[1]);
  });

  it("returns the first palette color when none are used", () => {
    expect(nextTagColor({})).toBe(TAG_PALETTE[0]);
  });

  it("cycles to the next color when all palette colors are used", () => {
    const all = TAG_PALETTE.map((color, i) => ({
      id: `t${i}`,
      name: `T${i}`,
      color,
    }));
    expect(nextTagColor(makeDefs(...all))).toBe(TAG_PALETTE[0]);
  });
});

describe("getTagById", () => {
  it("returns the definition for an existing id", () => {
    const d = makeDefs({ id: "a", name: "A", color: "#00C896" });
    expect(getTagById(d, "a")?.name).toBe("A");
  });

  it("returns undefined for an unknown id", () => {
    expect(getTagById({}, "nope")).toBeUndefined();
  });
});

describe("tagColor", () => {
  it("returns the tag color for an existing id", () => {
    const d = makeDefs({ id: "a", name: "A", color: "#00C896" });
    expect(tagColor(d, "a")).toBe("#00C896");
  });

  it("returns the first palette color for an unknown id", () => {
    expect(tagColor({}, "nope")).toBe(TAG_PALETTE[0]);
  });
});

describe("matchesTagFilter", () => {
  it("matches everything when no tags are selected", () => {
    expect(matchesTagFilter(makeProduct(), [])).toBe(true);
    expect(matchesTagFilter(makeProduct({ tags: ["a"] }), [])).toBe(true);
  });

  it("matches when the product has any selected tag (OR)", () => {
    expect(matchesTagFilter(makeProduct({ tags: ["b"] }), ["a", "b"])).toBe(true);
  });

  it("does not match when the product has none of the selected tags", () => {
    expect(matchesTagFilter(makeProduct({ tags: ["c"] }), ["a", "b"])).toBe(false);
  });

  it("does not match a product with no tags", () => {
    expect(matchesTagFilter(makeProduct(), ["a"])).toBe(false);
  });

  it("silently ignores orphaned tag ids", () => {
    const p = makeProduct({ tags: ["a"] });
    expect(matchesTagFilter(p, ["a", "missing"])).toBe(true);
    expect(matchesTagFilter(p, ["missing"])).toBe(false);
  });
});

describe("generateTagId", () => {
  it("returns a non-empty string", () => {
    expect(generateTagId()).toBeTruthy();
  });
});
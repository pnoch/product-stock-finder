import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/scrapers/registry", () => ({
  getParserByDistributorId: vi.fn(),
}));

import { getParserByDistributorId } from "../lib/scrapers/registry";
import { buildCatalogPairs, pickPairsToWarm } from "../server/catalog-warmer";

const mockedGetParser = vi.mocked(getParserByDistributorId);

describe("buildCatalogPairs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetParser.mockReturnValue({
      id: "server2u-my",
      baseUrl: "https://server2u.com",
      buildSearchUrl: (model: string) => `https://server2u.com/shop?q=${model}`,
      parsePrice: () => null,
      rateLimitMs: 0,
    });
  });

  it("returns the full cross product of catalog models and distributors", () => {
    const pairs = buildCatalogPairs();
    expect(pairs.length).toBeGreaterThan(0);
    expect(pairs).toContainEqual({ distributorId: "server2u-my", modelNumber: "CRS804-4DDQ-hRM" });
  });

  it("excludes distributors with no parser", () => {
    mockedGetParser.mockReturnValue(undefined);
    const pairs = buildCatalogPairs();
    expect(pairs).toHaveLength(0);
  });
});

describe("pickPairsToWarm", () => {
  const pairs = [
    { distributorId: "a", modelNumber: "m1" },
    { distributorId: "a", modelNumber: "m2" },
    { distributorId: "b", modelNumber: "m1" },
    { distributorId: "c", modelNumber: "m1" },
  ];

  it("picks never-fetched pairs first", () => {
    const fetchedAt = new Map<string, number>([
      ["a:m1", 1000],
      ["b:m1", 2000],
    ]);
    const picked = pickPairsToWarm(pairs, fetchedAt, 2);
    expect(picked).toHaveLength(2);
    expect(picked[0]).toEqual({ distributorId: "a", modelNumber: "m2" });
    expect(picked[1]).toEqual({ distributorId: "c", modelNumber: "m1" });
  });

  it("picks the oldest fetchedAt when all pairs have been fetched", () => {
    const fetchedAt = new Map<string, number>([
      ["a:m1", 3000],
      ["a:m2", 1000],
      ["b:m1", 2000],
      ["c:m1", 4000],
    ]);
    const picked = pickPairsToWarm(pairs, fetchedAt, 2);
    expect(picked).toEqual([
      { distributorId: "a", modelNumber: "m2" },
      { distributorId: "b", modelNumber: "m1" },
    ]);
  });

  it("respects the count limit", () => {
    const fetchedAt = new Map<string, number>();
    const picked = pickPairsToWarm(pairs, fetchedAt, 1);
    expect(picked).toHaveLength(1);
  });
});

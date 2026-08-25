import { describe, expect, it } from "vitest";
import {
  countTagMatches,
  countTagMatchesByIds,
  filterWatchlist,
  groupWatchlist,
  priceDropPercent,
  productRegion,
  productStatus,
  sortWatchlist,
  type WatchlistFilters,
} from "../lib/watchlist-org";
import type { DistributorListing, Product, TagDefinition } from "../lib/types";

function makeListing(
  distributorId: string,
  overrides: Partial<DistributorListing> = {},
): DistributorListing {
  return {
    distributorId,
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "x",
    lastChecked: "2026-01-01",
    priceHistory: [],
    ...overrides,
  };
}

function makeProduct(
  overrides: Partial<Product> = {},
  listings: DistributorListing[] = [],
): Product {
  return {
    id: "p1",
    name: "Test Product",
    modelNumber: "TP-1",
    brand: "Test",
    category: "Switch",
    description: "",
    addedAt: "2026-01-01T00:00:00.000Z",
    isWatched: true,
    listings,
    ...overrides,
  };
}

const defs: Record<string, TagDefinition> = {
  t1: { id: "t1", name: "Home", color: "#0F52BA" },
  t2: { id: "t2", name: "Lab", color: "#00C896" },
};

const baseFilters: WatchlistFilters = {
  region: "all",
  tagIds: [],
  tagMatchMode: "any",
  status: "all",
  query: "",
};

describe("productStatus", () => {
  it("returns in_stock when any listing is in stock", () => {
    const p = makeProduct({}, [
      makeListing("d1", { stockStatus: "out_of_stock" }),
      makeListing("d2", { stockStatus: "in_stock" }),
    ]);
    expect(productStatus(p)).toBe("in_stock");
  });

  it("returns back_order when no listing is in stock but one is back-ordered", () => {
    const p = makeProduct({}, [
      makeListing("d1", { stockStatus: "out_of_stock" }),
      makeListing("d2", { stockStatus: "back_order" }),
    ]);
    expect(productStatus(p)).toBe("back_order");
  });

  it("returns out_of_stock when all listings are out of stock", () => {
    const p = makeProduct({}, [
      makeListing("d1", { stockStatus: "out_of_stock" }),
    ]);
    expect(productStatus(p)).toBe("out_of_stock");
  });

  it("returns unknown when there are no listings", () => {
    expect(productStatus(makeProduct({}))).toBe("unknown");
  });
});

describe("productRegion", () => {
  it("returns the first listing's distributor region", () => {
    const p = makeProduct({}, [makeListing("server2u-my")]);
    expect(productRegion(p)).toBe("Asia-Pacific");
  });

  it("returns Unknown when there are no listings", () => {
    expect(productRegion(makeProduct({}))).toBe("Unknown");
  });
});

describe("priceDropPercent", () => {
  it("returns null when there is no best in-stock price", () => {
    const p = makeProduct({}, [
      makeListing("d1", { price: 100, stockStatus: "out_of_stock" }),
    ]);
    expect(priceDropPercent(p)).toBeNull();
  });

  it("returns null when there is no price history", () => {
    const p = makeProduct({}, [makeListing("d1")]);
    expect(priceDropPercent(p)).toBeNull();
  });

  it("computes the all-time drop percentage", () => {
    const p = makeProduct({}, [
      makeListing("d1", {
        price: 80,
        stockStatus: "in_stock",
        priceHistory: [
          { date: "2026-01-01", price: 100, currency: "USD", stockStatus: "in_stock" },
          { date: "2026-01-15", price: 120, currency: "USD", stockStatus: "in_stock" },
        ],
      }),
    ]);
    expect(priceDropPercent(p)).toBeCloseTo((120 - 80) / 120 * 100);
  });
});

describe("filterWatchlist", () => {
  const inStock = makeProduct(
    { id: "a", name: "Alpha", modelNumber: "A-1" },
    [makeListing("server2u-my", { stockStatus: "in_stock" })],
  );
  const backOrder = makeProduct(
    { id: "b", name: "Beta", modelNumber: "B-1" },
    [makeListing("server2u-my", { stockStatus: "back_order" })],
  );
  const tagged = makeProduct(
    { id: "c", name: "Gamma", modelNumber: "C-1", tags: ["t1"] },
    [makeListing("linitx-uk", { stockStatus: "out_of_stock" })],
  );

  it("matches query against name and model, case-insensitive", () => {
    const list = [inStock, backOrder, tagged];
    expect(filterWatchlist(list, { ...baseFilters, query: "ALPHA" }).map((p) => p.id)).toEqual(["a"]);
    expect(filterWatchlist(list, { ...baseFilters, query: "c-1" }).map((p) => p.id)).toEqual(["c"]);
  });

  it("filters by region", () => {
    const list = [inStock, tagged];
    expect(filterWatchlist(list, { ...baseFilters, region: "Asia-Pacific" }).map((p) => p.id)).toEqual(["a"]);
    expect(filterWatchlist(list, { ...baseFilters, region: "Europe" }).map((p) => p.id)).toEqual(["c"]);
  });

  it("filters by tag ids (OR)", () => {
    const list = [inStock, tagged];
    expect(filterWatchlist(list, { ...baseFilters, tagIds: ["t1"] }).map((p) => p.id)).toEqual(["c"]);
    expect(filterWatchlist(list, { ...baseFilters, tagIds: ["t1", "t2"] }).map((p) => p.id)).toEqual(["c"]);
  });

  it("filters by status", () => {
    const list = [inStock, backOrder, tagged];
    expect(filterWatchlist(list, { ...baseFilters, status: "in_stock" }).map((p) => p.id)).toEqual(["a"]);
    expect(filterWatchlist(list, { ...baseFilters, status: "back_order" }).map((p) => p.id)).toEqual(["b"]);
  });

  it("combines filters with AND", () => {
    const list = [inStock, tagged];
    expect(
      filterWatchlist(list, { ...baseFilters, region: "Europe", tagIds: ["t1"] }).map((p) => p.id),
    ).toEqual(["c"]);
  });
});

describe("filterWatchlist tag modes", () => {
  const both = makeProduct(
    { id: "x", name: "X", modelNumber: "X-1", tags: ["t1", "t2"] },
    [makeListing("server2u-my")],
  );
  const onlyT1 = makeProduct(
    { id: "y", name: "Y", modelNumber: "Y-1", tags: ["t1"] },
    [makeListing("server2u-my")],
  );
  const none = makeProduct({ id: "z", name: "Z", modelNumber: "Z-1" }, [
    makeListing("server2u-my"),
  ]);
  const list = [both, onlyT1, none];

  it("OR mode matches products with any selected tag", () => {
    expect(
      filterWatchlist(list, { ...baseFilters, tagIds: ["t1", "t2"] }).map(
        (p) => p.id,
      ),
    ).toEqual(["x", "y"]);
  });

  it("AND mode matches only products with every selected tag", () => {
    expect(
      filterWatchlist(list, {
        ...baseFilters,
        tagIds: ["t1", "t2"],
        tagMatchMode: "all",
      }).map((p) => p.id),
    ).toEqual(["x"]);
  });

  it("AND mode with a single tag matches like OR", () => {
    expect(
      filterWatchlist(list, {
        ...baseFilters,
        tagIds: ["t1"],
        tagMatchMode: "all",
      }).map((p) => p.id),
    ).toEqual(["x", "y"]);
  });

  it("AND mode combines with other filters", () => {
    expect(
      filterWatchlist(list, {
        ...baseFilters,
        tagIds: ["t1", "t2"],
        tagMatchMode: "all",
        status: "in_stock",
      }).map((p) => p.id),
    ).toEqual(["x"]);
  });
});

describe("countTagMatches", () => {
  const inStockT1 = makeProduct(
    { id: "a", name: "Alpha", modelNumber: "A-1", tags: ["t1", "t2"] },
    [makeListing("server2u-my", { stockStatus: "in_stock" })],
  );
  const backOrderT2 = makeProduct(
    { id: "b", name: "Beta", modelNumber: "B-1", tags: ["t2"] },
    [makeListing("server2u-my", { stockStatus: "back_order" })],
  );
  const outT1 = makeProduct(
    { id: "c", name: "Gamma", modelNumber: "C-1", tags: ["t1"] },
    [makeListing("server2u-my", { stockStatus: "out_of_stock" })],
  );
  const untagged = makeProduct({ id: "d", name: "Delta", modelNumber: "D-1" }, [
    makeListing("server2u-my", { stockStatus: "in_stock" }),
  ]);
  const list = [inStockT1, backOrderT2, outT1, untagged];

  it("counts products per tag across the whole list", () => {
    expect(
      countTagMatches(list, { region: "all", status: "all", query: "" }),
    ).toEqual({ t1: 2, t2: 2 });
  });

  it("respects the status filter", () => {
    expect(
      countTagMatches(list, { region: "all", status: "in_stock", query: "" }),
    ).toEqual({ t1: 1, t2: 1 });
  });

  it("respects the region filter", () => {
    const eu = makeProduct(
      { id: "e", name: "Epsilon", modelNumber: "E-1", tags: ["t1"] },
      [makeListing("linitx-uk")],
    );
    expect(
      countTagMatches([...list, eu], { region: "Europe", status: "all", query: "" }),
    ).toEqual({ t1: 1 });
  });

  it("respects the query filter", () => {
    expect(
      countTagMatches(list, { region: "all", status: "all", query: "BETA" }),
    ).toEqual({ t2: 1 });
  });

  it("returns an empty object when nothing matches", () => {
    expect(
      countTagMatches(list, { region: "all", status: "all", query: "zzz" }),
    ).toEqual({});
  });
});

describe("countTagMatchesByIds", () => {
  const a = makeProduct(
    { id: "a", name: "Alpha", modelNumber: "A-1", tags: ["t1", "t2"] },
    [makeListing("server2u-my", { stockStatus: "in_stock" })],
  );
  const b = makeProduct(
    { id: "b", name: "Beta", modelNumber: "B-1", tags: ["t2"] },
    [makeListing("server2u-my", { stockStatus: "back_order" })],
  );
  const c = makeProduct(
    { id: "c", name: "Gamma", modelNumber: "C-1", tags: ["t1"] },
    [makeListing("server2u-my", { stockStatus: "out_of_stock" })],
  );
  const untagged = makeProduct({ id: "d", name: "Delta", modelNumber: "D-1" }, [
    makeListing("server2u-my", { stockStatus: "in_stock" }),
  ]);
  const list = [a, b, c, untagged];

  it("counts tags only for products in the given id set", () => {
    expect(countTagMatchesByIds(list, new Set(["a", "b"]))).toEqual({
      t1: 1,
      t2: 2,
    });
  });

  it("counts across all ids when the set includes every product", () => {
    expect(countTagMatchesByIds(list, new Set(list.map((p) => p.id)))).toEqual({
      t1: 2,
      t2: 2,
    });
  });

  it("ignores ids not present in the list", () => {
    expect(countTagMatchesByIds(list, new Set(["a", "zzz"]))).toEqual({
      t1: 1,
      t2: 1,
    });
  });

  it("returns an empty object when no ids match", () => {
    expect(countTagMatchesByIds(list, new Set(["zzz"]))).toEqual({});
  });
});

describe("sortWatchlist", () => {
  const recent = makeProduct({ id: "a", addedAt: "2026-01-01" });
  const older = makeProduct({ id: "b", addedAt: "2025-01-01" });
  const cheap = makeProduct({ id: "c" }, [makeListing("d1", { price: 50 })]);
  const pricey = makeProduct({ id: "d" }, [makeListing("d1", { price: 200 })]);

  it("sorts by recent addedAt desc", () => {
    expect(sortWatchlist([older, recent], "recent").map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("sorts by best price asc", () => {
    expect(sortWatchlist([pricey, cheap], "best_price").map((p) => p.id)).toEqual(["c", "d"]);
  });

  it("sorts alphabetically", () => {
    expect(sortWatchlist([older, recent], "az").map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("sorts by price drop desc with nulls last", () => {
    const dropped = makeProduct({ id: "x" }, [
      makeListing("d1", {
        price: 50,
        priceHistory: [
          { date: "2026-01-01", price: 100, currency: "USD", stockStatus: "in_stock" },
        ],
      }),
    ]);
    const noHistory = makeProduct({ id: "y" }, [makeListing("d1", { price: 50 })]);
    expect(sortWatchlist([noHistory, dropped], "price_drop").map((p) => p.id)).toEqual(["x", "y"]);
  });

  it("sorts by status precedence", () => {
    const inStock = makeProduct({ id: "a" }, [makeListing("d1", { stockStatus: "in_stock" })]);
    const out = makeProduct({ id: "b" }, [makeListing("d1", { stockStatus: "out_of_stock" })]);
    const back = makeProduct({ id: "c" }, [makeListing("d1", { stockStatus: "back_order" })]);
    expect(sortWatchlist([out, inStock, back], "status").map((p) => p.id)).toEqual(["a", "c", "b"]);
  });

  it("sorts by region alphabetically", () => {
    const eu = makeProduct({ id: "a" }, [makeListing("linitx-uk")]);
    const apac = makeProduct({ id: "b" }, [makeListing("server2u-my")]);
    expect(sortWatchlist([eu, apac], "region").map((p) => p.id)).toEqual(["b", "a"]);
  });
});

describe("groupWatchlist", () => {
  const inStock = makeProduct({ id: "a" }, [makeListing("server2u-my", { stockStatus: "in_stock" })]);
  const backOrder = makeProduct({ id: "b" }, [makeListing("server2u-my", { stockStatus: "back_order" })]);
  const tagged = makeProduct({ id: "c", tags: ["t1", "t2"] });
  const untagged = makeProduct({ id: "d" });

  it("returns a single flat section for off", () => {
    const sections = groupWatchlist([inStock, tagged], "off", defs);
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe("all");
    expect(sections[0].products.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("returns empty when the list is empty", () => {
    expect(groupWatchlist([], "off", defs)).toEqual([]);
  });

  it("groups by tag with an untagged section at the end", () => {
    const sections = groupWatchlist([untagged, tagged], "tag", defs);
    expect(sections.map((s) => s.key)).toEqual(["tag-t1", "tag-t2", "untagged"]);
    expect(sections[0].products.map((p) => p.id)).toEqual(["c"]);
    expect(sections[2].products.map((p) => p.id)).toEqual(["d"]);
  });

  it("groups by status, omitting empty sections", () => {
    const sections = groupWatchlist([inStock, backOrder], "status", defs);
    expect(sections.map((s) => s.key)).toEqual(["status-in_stock", "status-back_order"]);
  });

  it("groups by region alphabetically", () => {
    const apac = makeProduct({ id: "a" }, [makeListing("server2u-my")]);
    const eu = makeProduct({ id: "b" }, [makeListing("linitx-uk")]);
    const sections = groupWatchlist([eu, apac], "region", defs);
    expect(sections.map((s) => s.key)).toEqual(["region-Asia-Pacific", "region-Europe"]);
  });
});

describe("groupWatchlist with orphaned tag ids", () => {
  it("treats products holding only orphaned tag ids as untagged", () => {
    const orphaned = makeProduct({ id: "x", tags: ["deleted-tag"] });
    const sections = groupWatchlist([orphaned], "tag", defs);
    expect(sections.map((s) => s.key)).toEqual(["untagged"]);
    expect(sections[0]!.products.map((p) => p.id)).toEqual(["x"]);
  });

  it("keeps live tags working alongside orphaned ones", () => {
    const mixed = makeProduct({ id: "y", tags: ["t1", "deleted-tag"] });
    const sections = groupWatchlist([mixed], "tag", defs);
    expect(sections.map((s) => s.key)).toEqual(["tag-t1"]);
  });
});

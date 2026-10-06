import { describe, expect, it } from "vitest";
import {
  watchlistToCsv,
  watchlistToDetailedCsv,
  parseDetailedCsv,
  detailedCsvToProducts,
  parseBulkImportCsv,
  parseWatchlistCsv,
} from "../lib/csv";
import type { DistributorListing, Product } from "../lib/types";

function listing(overrides: Partial<DistributorListing>): DistributorListing {
  return {
    distributorId: "winncom-us",
    productId: "p1",
    price: 100,
    currency: "USD",
    stockStatus: "in_stock",
    url: "",
    lastChecked: new Date().toISOString(),
    priceHistory: [],
    ...overrides,
  } as DistributorListing;
}

function product(id: string, listings: DistributorListing[]): Product {
  return {
    id,
    name: `Product ${id}`,
    brand: "MikroTik",
    category: "Routers",
    modelNumber: id.toUpperCase(),
    description: "",
    isWatched: true,
    addedAt: new Date().toISOString(),
    listings,
  } as unknown as Product;
}

describe("watchlistToDetailedCsv placeholder row", () => {
  it("emits a row with unknown status for a product with no listings", () => {
    const csv = watchlistToDetailedCsv([product("p1", [])]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    const cols = lines[1]!.split(",");
    expect(cols[0]).toBe("Product p1");
    expect(cols[7]).toBe("unknown");
  });
});

describe("resolveStockStatus precedence", () => {
  const statusFor = (statuses: DistributorListing["stockStatus"][]) =>
    watchlistToCsv(
      [product("p", statuses.map((s, i) => listing({ stockStatus: s, distributorId: `d${i}` })))],
      "USD",
    )
      .split("\n")[1]!
      .split(",")[5];

  it("ranks in_stock above the rest", () => {
    expect(statusFor(["out_of_stock", "back_order", "in_stock"])).toBe("in_stock");
  });
  it("ranks back_order above out_of_stock and unknown", () => {
    expect(statusFor(["unknown", "out_of_stock", "back_order"])).toBe("back_order");
  });
  it("ranks out_of_stock above unknown", () => {
    expect(statusFor(["unknown", "out_of_stock"])).toBe("out_of_stock");
  });
  it("falls back to unknown when every listing is unknown", () => {
    expect(statusFor(["unknown", "unknown"])).toBe("unknown");
  });
});

describe("parseDetailedCsv edge cases", () => {
  it("returns [] for blank input", () => {
    expect(parseDetailedCsv("")).toEqual([]);
    expect(parseDetailedCsv("\n\n")).toEqual([]);
  });

  it("parses data rows when there is no header", () => {
    const rows = parseDetailedCsv("Foo,FM1,Brand,Cat,dist1,10,USD,in_stock,http://x");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ distributor: "dist1", price: "10" });
  });

  it("skips rows with fewer than five columns", () => {
    expect(parseDetailedCsv("a,b,c,d")).toEqual([]);
  });

  it("pads a short row (defaults to empty fields)", () => {
    const [row] = parseDetailedCsv("Foo,FM1,Brand,Cat,dist1");
    expect(row!.price).toBe("");
    expect(row!.url).toBe("");
  });

  it("unescapes a doubled quote inside a quoted field", () => {
    const [row] = parseDetailedCsv(
      'product,model,brand,category,distributor,price,currency,stockStatus,url\n"a""b",M1,,,d1,1,USD,in_stock,',
    );
    expect(row!.product).toBe('a"b');
  });

  it("keeps a data row whose product column is empty but the model is set", () => {
    // A blank product name is valid: detailedCsvToProducts falls back to the
    // model (`name: r.product || r.model`). The row must not be mistaken for a
    // blank/comment line and dropped.
    const rows = parseDetailedCsv(
      "product,model,brand,category,distributor,price,currency,stockStatus,url\n,CRS326,MikroTik,Switch,mikrotikstore,209,USD,in_stock,https://x/p",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.model).toBe("CRS326");
    expect(rows[0]!.product).toBe("");
  });

  it("round-trips a product with an empty name through the detailed CSV", () => {
    const p = {
      id: "CRS326",
      name: "",
      modelNumber: "CRS326-24G-2S+RM",
      brand: "MikroTik",
      category: "Switch",
      description: "",
      isWatched: true,
      addedAt: new Date().toISOString(),
      listings: [listing({ distributorId: "mikrotikstore", price: 209 })],
    } as unknown as Product;
    const parsed = parseWatchlistCsv(watchlistToDetailedCsv([p]));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.modelNumber).toBe("CRS326-24G-2S+RM");
  });

  it("keeps a row whose model is whitespace-only but the product name is set", () => {
    // `(r.model || r.product).trim()` picked the truthy-but-blank model, trimmed
    // it to "", and dropped the row even though the product name was valid.
    const parsed = parseWatchlistCsv(
      "product,model,brand,category,distributor,price,currency,stockStatus,url\nRouter A,\t,,,d1,1,USD,in_stock,",
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.name).toBe("Router A");
  });
});

describe("detailedCsvToProducts edge cases", () => {
  const row = (o: Record<string, string> = {}) => ({
    product: "P",
    model: "",
    brand: "",
    category: "",
    distributor: "",
    price: "",
    currency: "",
    stockStatus: "",
    url: "",
    ...o,
  });

  it("creates the product even when the row has no distributor (no listing)", () => {
    const [p] = detailedCsvToProducts([row({ model: "M1" })]);
    expect(p!.id).toBe("M1");
    expect(p!.listings).toHaveLength(0);
  });

  it("replaces a duplicate listing for the same product + distributor", () => {
    const products = detailedCsvToProducts([
      row({ model: "M1", distributor: "d1", price: "5" }),
      row({ model: "M1", distributor: "d1", price: "9" }),
    ]);
    expect(products[0]!.listings).toHaveLength(1);
    expect(products[0]!.listings[0]!.price).toBe(9);
  });

  it("maps a bogus stock status and non-finite price to safe defaults", () => {
    const [p] = detailedCsvToProducts([
      row({ model: "M1", distributor: "d1", price: "abc", stockStatus: "bogus" }),
    ]);
    expect(p!.listings[0]!.stockStatus).toBe("unknown");
    expect(p!.listings[0]!.price).toBe(0);
    expect(p!.listings[0]!.currency).toBe("USD");
  });

  it("skips a row with neither product nor model", () => {
    expect(detailedCsvToProducts([row({ product: "", model: "" })])).toEqual([]);
  });
});

describe("parseBulkImportCsv edge cases", () => {
  it("accepts the modelNumber header alias", () => {
    const { rows } = parseBulkImportCsv(
      "modelNumber,targetPrice,currency,tags\nM1,10,EUR,routers",
    );
    expect(rows[0]).toMatchObject({
      model: "M1",
      targetPrice: 10,
      currency: "EUR",
      tags: ["routers"],
    });
  });

  it("nulls a zero/non-numeric price, uppercases currency, splits and caps tags", () => {
    const tags = Array.from({ length: 12 }, (_, i) => `t${i}`).join(";");
    const { rows } = parseBulkImportCsv(
      `model,targetPrice,currency,tags\nM1,0,eur,${tags}\nM2,abc,usd,`,
    );
    expect(rows[0]!.targetPrice).toBeNull();
    expect(rows[0]!.currency).toBe("EUR");
    expect(rows[0]!.tags).toHaveLength(10);
    expect(rows[1]!.targetPrice).toBeNull();
    expect(rows[1]!.tags).toEqual([]);
  });

  it("parses a row without a header and treats a bare CR as a row break", () => {
    const { rows } = parseBulkImportCsv("M1,10,USD,router\rM2,20,USD,router2");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ model: "M1", targetPrice: 10 });
    expect(rows[1]).toMatchObject({ model: "M2", targetPrice: 20 });
  });

  it("returns empty for blank input", () => {
    expect(parseBulkImportCsv("")).toEqual({ rows: [], truncated: false });
  });

  it("skips a row whose model column is empty", () => {
    const { rows } = parseBulkImportCsv(
      "targetPrice,model,currency,tags\n10,,USD,router\n20,M2,USD,router2",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.model).toBe("M2");
  });
});

describe("parseWatchlistCsv summary edge cases", () => {
  it("returns [] for blank input", () => {
    expect(parseWatchlistCsv("")).toEqual([]);
  });

  it("parses a header-less summary and pads a short row", () => {
    const products = parseWatchlistCsv("Router A,M1");
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({ name: "Router A", modelNumber: "M1" });
  });

  it("dedups rows sharing a model", () => {
    const products = parseWatchlistCsv(
      "Router A,M1,MikroTik,Routers,$10,in_stock\nRouter A dup,M1,MikroTik,Routers,$9,in_stock",
    );
    expect(products).toHaveLength(1);
  });

  it("skips a legacy // comment line", () => {
    const products = parseWatchlistCsv(
      "// legacy comment\nRouter A,M1,MikroTik,Routers,$10,in_stock",
    );
    expect(products).toHaveLength(1);
    expect(products[0]!.modelNumber).toBe("M1");
  });

  it("skips a shareUrl header row", () => {
    const products = parseWatchlistCsv("shareUrl,product,model\nhttp://x,Router A,M1");
    expect(products).toHaveLength(1);
    expect(products.some((p) => p.name === "shareUrl")).toBe(false);
  });
});

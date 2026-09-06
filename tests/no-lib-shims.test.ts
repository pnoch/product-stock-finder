import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

describe("no deprecated lib shims", () => {
  it("deletes the pure re-export shims", () => {
    for (const f of [
      "lib/distributors.ts",
      "lib/catalog.ts",
      "lib/trending.ts",
      "lib/compare-utils.ts",
    ]) {
      expect(existsSync(f), `${f} should be deleted`).toBe(false);
    }
  });

  it("converts currency and fx into documented live modules", async () => {
    const currency = await readFile("lib/currency.ts", "utf8");
    const fx = await readFile("lib/fx.ts", "utf8");
    expect(currency).not.toContain("Deprecated");
    expect(currency).not.toContain("export { CURRENCY_SYMBOLS");
    expect(currency).not.toContain("export { EXCHANGE_RATES }");
    expect(currency).toContain("setExchangeRates");
    expect(fx).not.toContain("Deprecated");
    expect(fx).toContain("refreshFxRates");
  });

  it("points biggest former importers at shared", async () => {
    const detail = await readFile("app/product/[id].tsx", "utf8");
    const warmer = await readFile("server/catalog-warmer.ts", "utf8");
    expect(detail).toContain("@shared/distributors");
    expect(warmer).toContain("../shared/src/catalog.js");
  });
});

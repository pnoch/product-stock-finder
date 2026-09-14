import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  BUDGETS,
  tryConsumeBudget,
  clearSpendBudgetsForTests,
} from "../server/spend-budget";

describe("spend budget", () => {
  beforeEach(() => clearSpendBudgetsForTests());
  afterEach(() => vi.useRealTimers());

  it("allows calls up to the limit then refuses", () => {
    const { limit } = BUDGETS["products.parse"];
    for (let i = 0; i < limit; i++) {
      expect(tryConsumeBudget("products.parse")).toBe(true);
    }
    expect(tryConsumeBudget("products.parse")).toBe(false);
  });

  it("isolates budgets per name", () => {
    const { limit } = BUDGETS["images.get"];
    for (let i = 0; i < limit; i++) tryConsumeBudget("images.get");
    expect(tryConsumeBudget("images.get")).toBe(false);
    // A different budget is unaffected.
    expect(tryConsumeBudget("insights.get")).toBe(true);
  });

  it("refills after the rolling window passes", () => {
    vi.useFakeTimers();
    const base = 1_000_000;
    vi.setSystemTime(base);
    const { limit, windowMs } = BUDGETS["insights.get"];
    for (let i = 0; i < limit; i++) tryConsumeBudget("insights.get");
    expect(tryConsumeBudget("insights.get")).toBe(false);
    vi.setSystemTime(base + windowMs + 1);
    expect(tryConsumeBudget("insights.get")).toBe(true);
  });

  it("honors SPEND_BUDGET_* env overrides at module load", async () => {
    vi.resetModules();
    process.env.SPEND_BUDGET_PRODUCTS_PARSE = "2";
    try {
      const mod = await import("../server/spend-budget");
      expect(mod.BUDGETS["products.parse"].limit).toBe(2);
      expect(mod.tryConsumeBudget("products.parse")).toBe(true);
      expect(mod.tryConsumeBudget("products.parse")).toBe(true);
      expect(mod.tryConsumeBudget("products.parse")).toBe(false);
    } finally {
      delete process.env.SPEND_BUDGET_PRODUCTS_PARSE;
      vi.resetModules();
    }
  });
});

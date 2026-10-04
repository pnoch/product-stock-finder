import { describe, expect, it } from "vitest";
import { distributorAnalysisToCsv } from "../lib/csv";
import type { DistributorAnalysis } from "../lib/distributor-analysis";

describe("distributorAnalysisToCsv", () => {
  it("emits the analysis columns, not the watchlist listing rows", () => {
    const analysis: DistributorAnalysis[] = [
      {
        distributorId: "winncom-us",
        coverage: 3,
        totalCost: 300,
        averagePrice: 100,
      },
    ];
    const csv = distributorAnalysisToCsv(analysis, "USD");
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "distributor,country,coverage,avgPrice,totalCost,currency",
    );
    expect(lines[1]).toContain(",3,");
    expect(lines[1]).toContain("100.00");
    expect(lines[1]).toContain("300.00");
    expect(lines[1]).toContain("USD");
    // The old bug exported the watchlist listing header instead.
    expect(csv).not.toContain("stockStatus");
  });
});
